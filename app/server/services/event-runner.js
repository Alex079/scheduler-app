import { eventScheduled, eventStarted, eventCompleted, eventFailed, getUpcomingEvents, eventMissed, getAllScheduledEvents, markMissedPastEvents } from '../db/db.js';
import { createReadStream, createWriteStream } from 'fs';

const RECONNECT_DELAY_MS = 1000;

/**
 * Open the FIFO write end used to send recording commands to the ffmpeg service.
 * The stream is recreated after an error (e.g. the reader restarts) so commands
 * are not lost permanently when the ffmpeg container is recycled.
 */
let requestStream = null;
function getRequestStream() {
  if (!requestStream) {
    requestStream = createWriteStream('/pipe/request');
    requestStream.on('error', (err) => {
      console.error(`Request pipe error: ${err.message}`);
      requestStream = null;
    });
  }
  return requestStream;
}

function writeRequest(command) {
  getRequestStream().write(command + '\n');
}

/**
 * Handle one `ID=STATUS` line from the ffmpeg service.
 */
function handleResponseLine(line) {
  const [idPart, status] = line.split('=');
  const eventId = parseInt(idPart, 10);
  if (!Number.isInteger(eventId)) {
    console.warn(`[EVENT] Ignoring malformed response line: ${line}`);
    return;
  }
  if (status === 'OK') {
    console.log(`[EVENT ${eventId}] Recording completed successfully`);
    eventCompleted(eventId);
  } else if (status === 'FAILED') {
    console.log(`[EVENT ${eventId}] Recording failed`);
    eventFailed(eventId);
  } else {
    console.log(`Unknown response: ${line}`);
  }
}

/**
 * Read the FIFO response end. Data is buffered so status lines split across
 * chunk boundaries are parsed correctly, and the stream is reopened when it
 * ends or errors (e.g. the ffmpeg service restarts).
 */
let responseStream = null;
function openResponseStream() {
  responseStream = createReadStream('/pipe/response');
  let buffer = '';

  responseStream.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep the trailing partial line
    lines.forEach(line => {
      if (line.trim() !== '') handleResponseLine(line);
    });
  });

  responseStream.on('error', (err) => {
    console.error(`Response pipe error: ${err.message}`);
    setTimeout(openResponseStream, RECONNECT_DELAY_MS);
  });

  responseStream.on('end', () => {
    console.log('Response pipe closed; reopening...');
    setTimeout(openResponseStream, RECONNECT_DELAY_MS);
  });
}

openResponseStream();

// Map to track scheduled events: eventId => timeoutId
const scheduledEvents = new Map();

/**
 * Format Unix timestamp to ISO-like string for filename (removes colons/special chars)
 * 1771596000 → 2026-02-20T14-00-00
 */
function formatTimestampForFilename(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  const iso = date.toISOString();
  return iso.replace(/:/g, '-').slice(0, 19); // "2026-02-20T14-00-00"
}

/**
 * Sanitize filename - remove special characters
 */
function sanitizeFilename(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Build recording command for an event
 * @param {Object} event - Event object with name, start_time, end_time, playlist_entry_id
 * @param {Object} entry - Playlist entry object with entry_url, title
 * @returns {Object} { command: string, filename: string }
 */
function buildCommand(event) {
  if (!event.entry_url) {
    throw new Error('Event is missing Playlist stream URL');
  }

  const streamUrl = event.entry_url;
  const streamName = sanitizeFilename(event.entry_title || 'stream');
  const eventName = sanitizeFilename(event.name);
  const startFormatted = formatTimestampForFilename(event.start_time);
  const endFormatted = formatTimestampForFilename(event.end_time);
  const duration = event.end_time - event.start_time; // in seconds

  const filename = `${startFormatted}_${endFormatted}_${streamName}_${eventName}.mp4`;

  // The command is written to a FIFO and consumed by a shell loop that
  // performs unquoted word-splitting/globbing, so reject any values that
  // contain shell metacharacters or whitespace that would break parsing
  // or allow argument-injection into the ffmpeg invocation.
  const SAFE_PATTERN = /^[A-Za-z0-9._:@/+=?-]+$/;
  if (!SAFE_PATTERN.test(streamUrl)) {
    throw new Error('Stream URL contains disallowed characters');
  }
  if (!SAFE_PATTERN.test(filename)) {
    throw new Error('Output filename contains disallowed characters');
  }

  const command = `ID=${event.id} STREAM=${streamUrl} DURATION=${duration} OUTPUT=${filename}`;

  return { command, filename };
}

/**
 * Schedule an event for recording
 * @param {Object} event - Event object
 */
function scheduleEventRecording(event) {
  const now = Math.floor(Date.now() / 1000); // Current Unix timestamp
  const delay = (event.start_time - now) * 1000; // Convert to milliseconds

  if (delay < 0) {
    console.log(`[EVENT ${event.id}] Skipping (missed start time): ${event.name}`);
    eventMissed(event.id);
    return;
  }

  console.log(`[EVENT ${event.id}] Scheduled for ${new Date(event.start_time * 1000).toISOString()}: ${event.name}`);
  eventScheduled(event.id);

  function performEventRecording() {
    scheduledEvents.delete(event.id);
    try {
      const { command, filename } = buildCommand(event);
      eventStarted(event.id, filename);
      console.log(`[EVENT ${event.id}] Starting recording`);
      // Guard the request pipe: if there is no reader (e.g. the ffmpeg
      // container is down) the write stream errors. Rather than dropping the
      // command, mark the event back to 'scheduled' so the next minute tick
      // re-attempts it. Past events are still caught by markMissedPastEvents.
      if (!requestStream) {
        console.error(`[EVENT ${event.id}] ✗ Request pipe unavailable; will retry on next tick`);
        eventScheduled(event.id);
        return;
      }
      writeRequest(command);
    } catch (err) {
      console.error(`[EVENT ${event.id}] ✗ Failed to start recording: ${err.message}`);
      eventFailed(event.id);
    }
  }

  scheduledEvents.set(event.id, setTimeout(performEventRecording, delay));
}

/**
 * Check for events in the next 24 hours every minute and schedule recordings
 */
export function startEventScheduler() {
  console.log('Starting event scheduler...');
  getAllScheduledEvents().forEach(scheduleEventRecording); // reschedule on startup

  function tick() {
    getUpcomingEvents().forEach(scheduleEventRecording);
    // Events whose start time passed while the server was down (or before they
    // could be scheduled) would otherwise stay unrecorded forever.
    const missed = markMissedPastEvents();
    if (missed > 0) {
      console.log(`Marked ${missed} past event(s) as missed`);
    }
  }

  tick();
  setInterval(tick, 60 * 1000); // Every minute
}

/**
 * Stop the event scheduler: clear every pending recording timeout and stop
 * re-opening the response FIFO, so the process can exit cleanly.
 */
export function stopEventScheduler() {
  if (responseStream) {
    responseStream.destroy();
    responseStream = null;
  }
  scheduledEvents.forEach((timeoutId) => clearTimeout(timeoutId));
  scheduledEvents.clear();
  console.log('Event scheduler stopped');
}

/**
 * Cancel a scheduled event if it hasn't started yet
 * @param {number} eventId - Event ID to cancel
 * @returns {boolean} True if event was cancelled, false if not found
 */
export function cancelScheduledEvent(eventId) {
  const timeoutId = scheduledEvents.get(eventId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    scheduledEvents.delete(eventId);
    console.log(`[EVENT ${eventId}] Cancelled scheduled recording`);
    return true;
  }
  return false;
}
