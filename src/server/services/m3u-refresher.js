const fetch = require('node-fetch');

function parseM3U(content) {
  const lines = content.split('\n');
  const entries = [];
  let currentExtinf = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Extract EXTINF metadata
    if (line.startsWith('#EXTINF:')) {
      currentExtinf = parseExtinf(line);
    }
    // Skip other comments
    else if (line.startsWith('#') || !line) {
      continue;
    }
    // This is a URL entry
    else {
      const entry = {
        url: line,
        title: currentExtinf?.title || line.split('/').pop(),
        logo: currentExtinf?.logo || null,
      };
      entries.push(entry);
      currentExtinf = null; // Reset for next entry
    }
  }

  return entries;
}

function parseExtinf(extinf) {
  // Format: #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...", Title
  // Extract logo URL from tvg-logo attribute
  const logoMatch = extinf.match(/tvg-logo="([^"]*)"/) || extinf.match(/tvg-logo='([^']*)'/) || extinf.match(/tvg-logo=([^\s,]+)/);
  const logo = logoMatch ? logoMatch[1] : null;

  // Extract title - everything after the last comma
  const titleMatch = extinf.match(/,\s*(.+)$/);
  const title = titleMatch ? titleMatch[1].trim() : null;

  return { logo, title };
}

async function refreshPlaylist(db, playlistId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT url FROM m3u_playlists WHERE id = ?', [playlistId], async (err, playlist) => {
      if (err || !playlist) {
        return reject(err || new Error('Playlist not found'));
      }

      try {
        const response = await fetch(playlist.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch M3U: ${response.statusText}`);
        }

        const content = await response.text();
        const newEntries = parseM3U(content);

        // Get existing entries for this playlist
        db.all('SELECT id, entry_url FROM m3u_entries WHERE playlist_id = ?', [playlistId], (err, existingEntries) => {
          if (err) return reject(err);

          const existingUrls = new Set(existingEntries.map(e => e.entry_url));
          const newUrls = new Set(newEntries.map(e => e.url));

          // Find entries to delete (URLs that are no longer in the new playlist)
          const entriesToDelete = existingEntries
            .filter(e => !newUrls.has(e.entry_url))
            .map(e => e.id);

          // Find entries to add (URLs that are new)
          const entriesToAdd = newEntries.filter(e => !existingUrls.has(e.url));

          // Find entries to update (URLs that exist but might have new title/logo)
          const entriesToUpdate = newEntries.filter(e => existingUrls.has(e.url));

          // Delete entries that no longer exist in the playlist
          if (entriesToDelete.length > 0) {
            const placeholders = entriesToDelete.map(() => '?').join(',');
            db.run(`DELETE FROM m3u_entries WHERE id IN (${placeholders})`, entriesToDelete, (err) => {
              if (err) return reject(err);
              processUpdatesAndAdds();
            });
          } else {
            processUpdatesAndAdds();
          }

          function processUpdatesAndAdds() {
            // Update entries with new title/logo
            const updateStmt = db.prepare(
              'UPDATE m3u_entries SET title = ?, logo = ? WHERE playlist_id = ? AND entry_url = ?'
            );

            entriesToUpdate.forEach(entry => {
              updateStmt.run([entry.title, entry.logo, playlistId, entry.url]);
            });

            // Add new entries
            const insertStmt = db.prepare(
              'INSERT INTO m3u_entries (playlist_id, entry_url, title, logo) VALUES (?, ?, ?, ?)'
            );

            entriesToAdd.forEach(entry => {
              insertStmt.run([playlistId, entry.url, entry.title, entry.logo]);
            });

            updateStmt.finalize((err) => {
              if (err) return reject(err);

              insertStmt.finalize((err) => {
                if (err) return reject(err);

                // Update last_refreshed timestamp (Unix timestamp in seconds)
                db.run(
                  "UPDATE m3u_playlists SET last_refreshed = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = ?",
                  [playlistId],
                  (err) => {
                    if (err) return reject(err);
                    const summary = `[+${entriesToAdd.length} ~${entriesToUpdate.length} -${entriesToDelete.length}]`;
                    console.log(`✓ Refreshed M3U playlist ${playlistId}: ${summary} (total: ${newEntries.length})`);
                    resolve(newEntries.length);
                  }
                );
              });
            });
          }
        });
      } catch (error) {
        console.error(`✗ Failed to refresh M3U playlist ${playlistId}:`, error.message);
        reject(error);
      }
    });
  });
}

function startDailyRefresh(db) {
  /**
   * Refresh all playlists
   */
  function refreshAllPlaylists() {
    db.all('SELECT id FROM m3u_playlists', (err, playlists) => {
      if (err) {
        console.error('Failed to load playlists:', err);
        return;
      }
      if (!playlists || playlists.length === 0) {
        console.log('No M3U playlists to refresh');
        return;
      }
      playlists.forEach(p => {
        refreshPlaylist(db, p.id).catch(err => console.error('Refresh error:', err));
      });
    });
  }

  // Refresh all playlists immediately on startup
  console.log('Refreshing M3U playlists on startup...');
  refreshAllPlaylists();

  // Schedule daily refresh at midnight
  setInterval(() => {
    console.log('Running daily M3U playlist refresh...');
    refreshAllPlaylists();
  }, 24 * 60 * 60 * 1000); // Every 24 hours
}

module.exports = { refreshPlaylist, startDailyRefresh };
