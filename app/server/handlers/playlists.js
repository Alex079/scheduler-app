import { createNewPlaylist, deletePlaylist, getAllPlaylists, getPlaylistById, getPlaylistEntries } from "../db/db.js";
import { refreshPlaylist } from "../services/playlist-refresher.js";

export function performGetAllPlaylists(req, res) {
  return res.status(200).json(getAllPlaylists());
}

export function performGetPlaylistEntries(req, res) {
  return res.status(200).json(getPlaylistEntries(req.params.id));
}

export async function performAddPlaylist(req, res) {
  const { url, name } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const playlist = createNewPlaylist(url, name || url);
  if (!playlist) {
    return res.status(400).json({ error: 'Failed to create playlist' });
  }

  try {
    await refreshPlaylist(playlist);
  } catch (error) {
    // Playlist is still created; the scheduler will retry refreshing it.
    console.error(`[PLAYLIST ${playlist.id}] ✗ Failed to refresh ${playlist.name}:`, error.message);
  }

  return res.status(201).json(playlist);
}

export function performDeletePlaylist(req, res) {
  return res.status(200).json(deletePlaylist(req.params.id));
}

export async function performRefreshPlaylist(req, res) {
  const playlist = getPlaylistById(req.params.id);
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  try {
    await refreshPlaylist(playlist);
    return res.status(200).json({ message: 'Playlist refreshed' });
  } catch (error) {
    console.error(`[PLAYLIST ${playlist.id}] ✗ Failed to refresh ${playlist.name}:`, error.message);
    return res.status(502).json({ error: 'Failed to refresh playlist' });
  }
}
