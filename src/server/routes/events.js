const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getDatabase } = require('../db');
const { cancelScheduledEvent } = require('../services/event-runner');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const RECORDINGS_DIR = path.join(__dirname, '../../recordings');

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
      e.recording_file,
      e.recording_status,
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
  const eventId = parseInt(req.params.id, 10);
  const db = getDatabase();

  cancelScheduledEvent(eventId);
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

// Get all recordings
router.get('/recordings', verifyToken, (req, res) => {
  // Ensure recordings directory exists
  if (!fs.existsSync(RECORDINGS_DIR)) {
    return res.json([]);
  }

  try {
    const files = fs.readdirSync(RECORDINGS_DIR).filter(f => f.endsWith('.mp4'));
    const recordings = files.map(filename => {
      const filepath = path.join(RECORDINGS_DIR, filename);
      const stats = fs.statSync(filepath);
      return {
        filename,
        size: stats.size,
        created: stats.birthtime,
      };
    });
    res.json(recordings.sort((a, b) => new Date(b.created) - new Date(a.created)));
  } catch (err) {
    console.error('Failed to list recordings:', err);
    res.status(500).json({ error: 'Failed to list recordings' });
  }
});

module.exports = router;
