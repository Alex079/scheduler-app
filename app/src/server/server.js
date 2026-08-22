import express, { json, static as expressStatic } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import playlistRoutes from './routes/playlists.js';
import { initializeDatabase } from './db/db.js';
import { startEventScheduler } from './services/event-runner.js';
import { startPlaylistScheduler } from './services/playlist-refresher.js';

initializeDatabase();

startEventScheduler();

startPlaylistScheduler();

const PORT = process.env.APP_PORT || 3000;
const staticPath = '../../src/client/dist';

express()
  .use(cors())
  .use(json())
  .use('/api/auth', authRoutes)
  .use('/api/events', eventRoutes)
  .use('/api/playlists', playlistRoutes)
  .use(expressStatic(staticPath))
  .get('/', (req, res) => res.sendFile('index.html', {root: staticPath}))
  .listen(PORT, () => console.log(`Server running on port ${PORT}`));
