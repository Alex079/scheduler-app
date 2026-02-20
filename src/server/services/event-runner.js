const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const RECORDINGS_DIR = path.join(__dirname, '../../recordings');

// Map to track scheduled events: eventId => timeoutId
const scheduledEvents = new Map();

// Ensure recordings directory exists
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

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
function buildFFmpegCommand(event, entry) {
  if (!entry || !entry.entry_url) {
    throw new Error('Event is missing M3U stream URL');
  }

  const streamUrl = entry.entry_url;
  const streamName = sanitizeFilename(entry.title || 'stream');
  const eventName = sanitizeFilename(event.name);
  const startFormatted = formatTimestampForFilename(event.start_time);
  const endFormatted = formatTimestampForFilename(event.end_time);
  const duration = event.end_time - event.start_time; // in seconds
  const title = event.name;
  const description = `${entry.title}: ${new Date(event.start_time * 1000).toISOString()} - ${new Date(event.end_time * 1000).toISOString()}`;

  const filename = `${startFormatted}_${endFormatted}_${streamName}_${eventName}.mp4`;
  const outputPath = path.join(RECORDINGS_DIR, filename);
  
  const command = `ffmpeg -i "${streamUrl}" -t ${duration} -c:v copy -c:a copy -f mp4 -metadata title="${title}" -metadata description="${description}" "${outputPath}"`;

  return { command, outputPath, filename };
}

/**
 * Execute FFmpeg recording for an event
 */
function executeRecording(command, outputPath, eventId, eventName) {
  return new Promise((resolve, reject) => {
    console.log(`[EVENT ${eventId}] Starting FFmpeg recording: ${eventName}`);
    console.log(`[EVENT ${eventId}] Command: ${command}`);

    const ffmpeg = spawn('sh', ['-c', command], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`[EVENT ${eventId}] ✓ Recording completed: ${eventName}`);
        console.log(`[EVENT ${eventId}] Saved to: ${outputPath}`);
        resolve({ success: true, outputPath });
      } else {
        console.error(`[EVENT ${eventId}] ✗ FFmpeg failed with code ${code}`);
        console.error(`[EVENT ${eventId}] Error output: ${stderr}`);
        reject(new Error(`FFmpeg failed: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      console.error(`[EVENT ${eventId}] ✗ Failed to start FFmpeg: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Schedule an event for recording
 * @param {Object} event - Event object
 * @param {Object} entry - M3U entry object
 */
function scheduleEventRecording(db, event, entry) {
  const now = Math.floor(Date.now() / 1000); // Current Unix timestamp
  const delay = (event.start_time - now) * 1000; // Convert to milliseconds

  if (delay < 0) {
    console.log(`[EVENT ${event.id}] Skipping (already started): ${event.name}`);
    return;
  }

  console.log(`[EVENT ${event.id}] Scheduled for ${new Date(event.start_time * 1000).toISOString()}: ${event.name}`);

  // Mark event as scheduled to prevent duplicate scheduling
  db.run(
    'UPDATE events SET recording_status = ? WHERE id = ?',
    ['scheduled', event.id]
  );

  const timeoutId = setTimeout(() => {
    try {
      const { command, outputPath, filename } = buildFFmpegCommand(event, entry);
      
      // Update event with recording filename and started status
      db.run(
        'UPDATE events SET recording_file = ?, recording_status = ? WHERE id = ?',
        [filename, 'started', event.id]
      );

      executeRecording(command, outputPath, event.id, event.name)
        .then((result) => {
          // Mark event as recorded
          db.run(
            'UPDATE events SET recording_status = ? WHERE id = ?',
            ['completed', event.id]
          );
        })
        .catch((err) => {
          console.error(`[EVENT ${event.id}] Recording failed: ${err.message}`);
          db.run(
            'UPDATE events SET recording_status = ? WHERE id = ?',
            ['failed', event.id]
          );
        });
    } catch (err) {
      console.error(`[EVENT ${event.id}] Failed to build command: ${err.message}`);
    }
    // Clean up from scheduled events map
    scheduledEvents.delete(event.id);
  }, delay);

  // Track scheduled event for potential cancellation
  scheduledEvents.set(event.id, timeoutId);
}

/**
 * Load all future events and schedule them
 */
function startEventScheduler(db) {
  console.log('Starting event scheduler...');

  // Check for events in the next 24 hours every minute
  function checkUpcomingEvents() {
    const oneDayInSeconds = 24 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);
    db.all(
      `
      SELECT 
        e.id, 
        e.name, 
        e.start_time, 
        e.end_time,
        m.entry_url,
        m.title as m3u_title
      FROM events e
      INNER JOIN m3u_entries m ON e.m3u_entry_id = m.id
      WHERE e.start_time > ? AND e.start_time <= ? AND e.recording_status IS NULL
      ORDER BY e.start_time
      `,
      [now, now + oneDayInSeconds],
      (err, rows) => {
        if (err || !rows) {
          console.error('Failed to load events:', err);
          return;
        }

        rows.forEach((event) => {
          const entry = {
            entry_url: event.entry_url,
            title: event.m3u_title,
          };

          try {
            scheduleEventRecording(db, event, entry);
          } catch (err) {
            console.error(`Failed to schedule event ${event.id}:`, err.message);
          }
        });
      }
    );
  }

  // Run immediately and then every minute
  checkUpcomingEvents();
  setInterval(checkUpcomingEvents, 60 * 1000); // Every minute
}

/**
 * Cancel a scheduled event if it hasn't started yet
 * @param {number} eventId - Event ID to cancel
 * @returns {boolean} True if event was cancelled, false if not found
 */
function cancelScheduledEvent(eventId) {
  const timeoutId = scheduledEvents.get(eventId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    scheduledEvents.delete(eventId);
    console.log(`[EVENT ${eventId}] Cancelled scheduled recording`);
    return true;
  }
  return false;
}

module.exports = { startEventScheduler, buildFFmpegCommand, cancelScheduledEvent };
