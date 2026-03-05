import { Router } from 'express';
import { verifyToken } from '../handlers/auth.js';
import { performAddPlaylist, performDeletePlaylist, performGetAllPlaylists, performGetPlaylistEntries, performRefreshPlaylist } from '../handlers/playlists.js';

const router = Router();

router.get('/', verifyToken, performGetAllPlaylists);

router.get('/:id', verifyToken, performGetPlaylistEntries);

router.post('/', verifyToken, performAddPlaylist);

router.delete('/:id', verifyToken, performDeletePlaylist);

router.post('/:id', verifyToken, performRefreshPlaylist);

export default router;
