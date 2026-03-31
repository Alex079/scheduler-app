import fetch from 'node-fetch';
import { getAllOutdatedPlaylists, getPlaylistEntries, updatePlaylistEntries } from '../db/db.js';

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

export async function refreshPlaylist(playlist) {
  const newEntries = await fetch(playlist.url)
    .then(response => {
      if (response.ok) {
        return response.text();
      }
      throw new Error(`Failed to fetch playlist: ${response.statusText}`);
    })
    .then(parseM3U)
    .catch(error => {
      console.error(`[PLAYLIST ${playlist.id}] ✗ Failed to refresh ${playlist.name}:`, error.message);
      return [];
    });
  if (newEntries.length === 0) {
    console.warn(`[PLAYLIST ${playlist.id}] ⚠️ No entries found after refresh ${playlist.name}`);
    return;
  }
  const existingEntries = getPlaylistEntries(playlist.id);
  const existingUrls = new Set(existingEntries.map(e => e.entry_url));
  const newUrls = new Set(newEntries.map(e => e.url));

  const entriesToDelete = existingEntries.filter(e => !newUrls.has(e.entry_url)).map(e => e.id);
  const entriesToAdd = newEntries.filter(e => !existingUrls.has(e.url));
  const entriesToUpdate = newEntries.filter(e => existingUrls.has(e.url));

  updatePlaylistEntries(playlist.id, entriesToAdd, entriesToUpdate, entriesToDelete);
  const summary = `[+${entriesToAdd.length} ~${entriesToUpdate.length} -${entriesToDelete.length}]`;
  console.log(`[PLAYLIST ${playlist.id}] ✓ Refreshed ${playlist.name}: ${summary} (total: ${newEntries.length})`);
}

export function startPlaylistScheduler() {
  console.log('Starting playlist scheduler...');
  function refreshAllPlaylists() {
    getAllOutdatedPlaylists().forEach(refreshPlaylist);
  }
  refreshAllPlaylists();
  setInterval(refreshAllPlaylists, 12 * 60 * 60 * 1000); // Every 12 hours
}
