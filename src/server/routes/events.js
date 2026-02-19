const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getDatabase } = require('../db');

const router = express.Router();

// Get all events
router.get('/', verifyToken, (req, res) => {
  const db = getDatabase();
  db.all('SELECT * FROM events ORDER BY start_time', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Create event
router.post('/', verifyToken, (req, res) => {
  const { name, start_time, end_time } = req.body;

  if (!name || !start_time || !end_time) {
    return res.status(400).json({ error: 'Name, start_time, and end_time required' });
  }

  const db = getDatabase();
  db.run(
    'INSERT INTO events (name, start_time, end_time, created_by) VALUES (?, ?, ?, ?)',
    [name, start_time, end_time, req.userId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, name, start_time, end_time, created_by: req.userId });
    }
  );
});

// Update event
router.put('/:id', verifyToken, (req, res) => {
  const { name, start_time, end_time } = req.body;
  const eventId = req.params.id;

  if (!name || !start_time || !end_time) {
    return res.status(400).json({ error: 'Name, start_time, and end_time required' });
  }

  const db = getDatabase();
  db.run(
    'UPDATE events SET name = ?, start_time = ?, end_time = ? WHERE id = ?',
    [name, start_time, end_time, eventId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json({ id: eventId, name, start_time, end_time });
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
