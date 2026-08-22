import { createNewPlaylist, deletePlaylist, getAllPlaylists, getPlaylistEntries } from "../db/db.js";
import { refreshPlaylist } from "../services/playlist-refresher.js";

export function performGetAllPlaylists(req, res) {
  return res.status(200).json(getAllPlaylists());
}

export function performGetPlaylistEntries(req, res) {
  return res.status(200).json(getPlaylistEntries(req.params.id));
}

export function performAddPlaylist(req, res) {
  const { url, name } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const playlist = createNewPlaylist(url, name || url);
   if (playlist) {
      refreshPlaylist(playlist.id);
      return res.status(201).json(playlist);
   } else {
      return res.status(400).json({ error: 'Failed to create playlist' });
   }
}

export function performDeletePlaylist(req, res) {
  return res.status(200).json(deletePlaylist(req.params.id));
}

export function performRefreshPlaylist(req, res) {
  refreshPlaylist(req.params.id)
  return res.status(204).send();
}
