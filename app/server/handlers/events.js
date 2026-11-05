import { getAllEvents, createNewEvent, updateEvent, deleteEvent, getPlaylistEntryById } from '../db/db.js';
import { cancelScheduledEvent } from '../services/event-runner.js';

/**
 * Get all events with their associated Playlist entry details
 */
export function performGetAllEvents(req, res) {
  return res.status(200).json(getAllEvents());
}

/**
 * Validate the shared event payload. Returns an error message, or null if valid.
 */
function validateEventInput({ name, start_time, end_time, playlist_entry_id }) {
  if (!name || !start_time || !end_time || !playlist_entry_id) {
    return 'Name, start_time, end_time, and playlist_entry_id are required';
  }
  if (!Number.isFinite(Number(start_time)) || !Number.isFinite(Number(end_time))) {
    return 'start_time and end_time must be Unix timestamps in seconds';
  }
  if (!getPlaylistEntryById(playlist_entry_id)) {
    return 'playlist_entry_id must reference an existing playlist entry';
  }

  const now = Math.floor(Date.now() / 1000);
  if (start_time < now - 300) {
    return 'Start time must be in the future';
  }
  if (start_time >= end_time) {
    return 'Start time must be before end time';
  }
  return null;
}

/**
 * Create a new event
 * Expects JSON body with: name, start_time, end_time, playlist_entry_id
 */
export function performCreateNewEvent(req, res) {
  const { name, start_time, end_time, playlist_entry_id } = req.body;

  const error = validateEventInput({ name, start_time, end_time, playlist_entry_id });
  if (error) {
    return res.status(400).json({ error });
  }

  return res.status(201).json(createNewEvent(name, start_time, end_time, playlist_entry_id, req.userId));
}

/**
 * Update an existing event by ID
 * Expects JSON body with: name, start_time, end_time, playlist_entry_id
 */
export function performUpdateEvent(req, res) {
  const { name, start_time, end_time, playlist_entry_id } = req.body;

  const error = validateEventInput({ name, start_time, end_time, playlist_entry_id });
  if (error) {
    return res.status(400).json({ error });
  }

  const eventId = parseInt(req.params.id, 10);

  cancelScheduledEvent(eventId);

  const updatedEvent = updateEvent(eventId, name, start_time, end_time, playlist_entry_id);
  if (updatedEvent) {
    return res.status(200).json(updatedEvent);
  }
  return res.status(404).json({ error: 'Event not found' });
}

/**
 * Delete an event by ID
 */
export function performDeleteEvent(req, res) {
  const eventId = parseInt(req.params.id, 10);

  cancelScheduledEvent(eventId);

  return res.status(200).json(deleteEvent(eventId));
}
