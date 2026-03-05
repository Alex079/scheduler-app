import { getAllEvents, createNewEvent, updateEvent, deleteEvent } from '../db/db.js';
import { cancelScheduledEvent } from '../services/event-runner.js';

/**
 * Get all events with their associated M3U entry details
 */
export function performGetAllEvents(req, res) {
  return res.status(200).json(getAllEvents());
}

/**
 * Create a new event
 * Expects JSON body with: name, start_time, end_time, m3u_entry_id
 */
export function performCreateNewEvent(req, res) {
  const { name, start_time, end_time, m3u_entry_id } = req.body;

  if (!name || !start_time || !end_time || !m3u_entry_id) {
    return res.status(400).json({ error: 'Name, start_time, end_time, and m3u_entry_id are required' });
  }

  return res.status(201).json(createNewEvent(name, start_time, end_time, m3u_entry_id, req.userId));
}

/**
 * Update an existing event by ID
 * Expects JSON body with: name, start_time, end_time, m3u_entry_id
 */
export function performUpdateEvent(req, res) {
  const { name, start_time, end_time, m3u_entry_id } = req.body;

  if (!name || !start_time || !end_time || !m3u_entry_id) {
    return res.status(400).json({ error: 'Name, start_time, end_time, and m3u_entry_id are required' });
  }

  const eventId = parseInt(req.params.id, 10);

  cancelScheduledEvent(eventId);

  const updatedEvent = updateEvent(eventId, name, start_time, end_time, m3u_entry_id);
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
