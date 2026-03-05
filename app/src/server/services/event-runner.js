import { eventScheduled, eventStarted, eventCompleted, eventFailed, getUpcomingEvents } from '../db/db.js';
import { createReadStream, createWriteStream } from 'fs';

const requestStream = createWriteStream('/pipe/request');
const responseStream = createReadStream('/pipe/response');

responseStream.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim() !== '');
  lines.forEach(line => {
    const [idPart, status] = line.split('=');
    const eventId = parseInt(idPart, 10);
    if (status === 'OK') {
      console.log(`[EVENT ${eventId}] Recording completed successfully`);
      eventCompleted(eventId);
    } else if (status === 'FAILED') {
      console.log(`[EVENT ${eventId}] Recording failed`);
      eventFailed(eventId);
    } else {
      console.log(`Unknown response: ${line}`);
    }
  });
});

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
 * Build FFmpeg command with template substitutions
 * @param {Object} event - Event object with name, start_time, end_time, m3u_entry_id
 * @param {Object} entry - M3U entry object with entry_url, title
 * @returns {Object} { command: string, outputPath: string }
 */
function buildCommand(event) {
  if (!event.entry_url) {
    throw new Error('Event is missing M3U stream URL');
  }

  const streamUrl = event.entry_url;
  const streamName = sanitizeFilename(event.entry_title || 'stream');
  const eventName = sanitizeFilename(event.name);
  const startFormatted = formatTimestampForFilename(event.start_time);
  const endFormatted = formatTimestampForFilename(event.end_time);
  const duration = event.end_time - event.start_time; // in seconds

  const filename = `${startFormatted}_${endFormatted}_${streamName}_${eventName}.mp4`;
  
  const command = `ID=${event.id}; STREAM=${streamUrl}; DURATION=${duration}; OUTPUT=${filename}`;

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
    console.log(`[EVENT ${event.id}] Skipping (already started): ${event.name}`);
    return;
  }

  console.log(`[EVENT ${event.id}] Scheduled for ${new Date(event.start_time * 1000).toISOString()}: ${event.name}`);
  eventScheduled(event.id);

  function performEventRecording() {
    const { command, filename } = buildCommand(event);
    eventStarted(event.id, filename);
    console.log(`[EVENT ${event.id}] Starting recording`);
    requestStream.write(command + '\n');
    scheduledEvents.delete(event.id);
  }

  scheduledEvents.set(event.id, setTimeout(performEventRecording, delay));
}

/**
 * Check for events in the next 24 hours every minute and schedule recordings
 */
export function startEventScheduler() {
  console.log('Starting event scheduler...');
  function checkUpcomingEvents() {
    getUpcomingEvents().forEach(scheduleEventRecording);
  }
  checkUpcomingEvents();
  setInterval(checkUpcomingEvents, 60 * 1000); // Every minute
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
