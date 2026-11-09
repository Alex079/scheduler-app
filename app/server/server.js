import express, { json, static as expressStatic } from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import playlistRoutes from './routes/playlists.js';
import { initializeDatabase, closeDatabase } from './db/db.js';
import { startEventScheduler, stopEventScheduler } from './services/event-runner.js';
import { startPlaylistScheduler, stopPlaylistScheduler } from './services/playlist-refresher.js';

initializeDatabase();

startEventScheduler();

startPlaylistScheduler();

const PORT = process.env.APP_PORT || 3000;
const staticPath = path.resolve(__dirname, '../client/dist');

function shutdown() {
  console.log('\nShutdown requested: stopping schedulers and closing resources...');
  stopEventScheduler();
  stopPlaylistScheduler();
  try {
    server.close(() => {
      console.log('HTTP server closed; exiting.');
      closeDatabase();
      process.exit(0);
    });
    // Failsafe: if there are lingering keep-alive connections, don't hang forever.
    setTimeout(() => {
      console.error('Shutdown timed out waiting for connections to drain; forcing exit.');
      closeDatabase();
      process.exit(0);
    }, 10000).unref();
  } catch (err) {
    console.error(`Error during shutdown: ${err.message}`);
    closeDatabase();
    process.exit(0);
  }
}

const server = express()
  .use(cors())
  .use(json())
  .use('/api/auth', authRoutes)
  .use('/api/events', eventRoutes)
  .use('/api/playlists', playlistRoutes)
  .use(expressStatic(staticPath))
  .get('/', (req, res) => res.sendFile('index.html', { root: staticPath }))
  .listen(PORT, () => console.log(`Server running on port ${PORT}`));

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
