const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getDatabase } = require('../db');
const { refreshPlaylist } = require('../services/m3u-refresher');

const router = express.Router();

// Get all M3U playlists
router.get('/playlists', verifyToken, (req, res) => {
  const db = getDatabase();
  db.all('SELECT id, url, name, last_refreshed FROM m3u_playlists ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows || []);
  });
});

// Get all M3U entries (optionally filtered by playlist)
router.get('/entries', verifyToken, (req, res) => {
  const db = getDatabase();
  const playlistId = req.query.playlistId;

  let query = 'SELECT id, playlist_id, entry_url, title, logo FROM m3u_entries';
  let params = [];

  if (playlistId) {
    query += ' WHERE playlist_id = ?';
    params.push(playlistId);
  }

  query += ' ORDER BY playlist_id, title';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows || []);
  });
});

// Add new M3U playlist
router.post('/playlists', verifyToken, async (req, res) => {
  const { url, name } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const db = getDatabase();
  db.run(
    'INSERT INTO m3u_playlists (url, name) VALUES (?, ?)',
    [url, name || url],
    async function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Playlist URL already exists' });
        }
        return res.status(500).json({ error: 'Database error' });
      }

      const playlistId = this.lastID;

      // Refresh immediately
      try {
        await refreshPlaylist(db, playlistId);
        res.status(201).json({ id: playlistId, url, name: name || url });
      } catch (error) {
        res.status(201).json({
          id: playlistId,
          url,
          name: name || url,
          warning: `Added but initial refresh failed: ${error.message}`,
        });
      }
    }
  );
});

// Delete M3U playlist
router.delete('/playlists/:id', verifyToken, (req, res) => {
  const db = getDatabase();
  const playlistId = req.params.id;

  // Delete playlist and associated entries (cascaded)
  db.run('DELETE FROM m3u_playlists WHERE id = ?', [playlistId], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json({ message: 'Playlist deleted' });
  });
});

// Manually trigger refresh for a playlist
router.post('/playlists/:id/refresh', verifyToken, async (req, res) => {
  const db = getDatabase();
  const playlistId = req.params.id;

  try {
    const count = await refreshPlaylist(db, playlistId);
    res.json({ message: `Refreshed with ${count} entries` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
