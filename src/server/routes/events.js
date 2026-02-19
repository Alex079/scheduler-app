const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getDatabase } = require('../db');

const router = express.Router();

// Get all events with M3U entry details
router.get('/', verifyToken, (req, res) => {
  const db = getDatabase();
  db.all(`
    SELECT 
      e.id, 
      e.name, 
      e.start_time, 
      e.end_time, 
      e.m3u_entry_id,
      e.created_by,
      e.created_at,
      m.entry_url,
      m.title as m3u_title
    FROM events e
    LEFT JOIN m3u_entries m ON e.m3u_entry_id = m.id
    ORDER BY e.start_time
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    // Unix timestamps are already numbers, no conversion needed
    res.json(rows || []);
  });
});

// Create event with optional M3U entry reference
router.post('/', verifyToken, (req, res) => {
  const { name, start_time, end_time, m3u_entry_id } = req.body;

  if (!name || !start_time || !end_time) {
    return res.status(400).json({ error: 'Name, start_time, and end_time required' });
  }

  const db = getDatabase();
  db.run(
    'INSERT INTO events (name, start_time, end_time, m3u_entry_id, created_by) VALUES (?, ?, ?, ?, ?)',
    [name, start_time, end_time, m3u_entry_id || null, req.userId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(201).json({
        id: this.lastID,
        name,
        start_time,
        end_time,
        m3u_entry_id: m3u_entry_id || null,
        created_by: req.userId,
      });
    }
  );
});

// Update event
router.put('/:id', verifyToken, (req, res) => {
  const { name, start_time, end_time, m3u_entry_id } = req.body;
  const eventId = req.params.id;

  if (!name || !start_time || !end_time) {
    return res.status(400).json({ error: 'Name, start_time, and end_time required' });
  }

  const db = getDatabase();
  db.run(
    'UPDATE events SET name = ?, start_time = ?, end_time = ?, m3u_entry_id = ? WHERE id = ?',
    [name, start_time, end_time, m3u_entry_id || null, eventId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json({ id: eventId, name, start_time, end_time, m3u_entry_id: m3u_entry_id || null });
    }
  );
});

// Delete event
router.delete('/:id', verifyToken, (req, res) => {
  const eventId = req.params.id;
  const db = getDatabase();

  db.run('DELETE FROM events WHERE id = ?', [eventId], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ message: 'Event deleted' });
  });
});

module.exports = router;
