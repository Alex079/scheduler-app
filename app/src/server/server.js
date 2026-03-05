import express, { json, static as expressStatic } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import playlistRoutes from './routes/playlists.js';
import { initializeDatabase } from './db/db.js';
import { startEventScheduler } from './services/event-runner.js';
import { startPlaylistScheduler } from './services/playlist-refresher.js';

const app = express();
const PORT = process.env.APP_PORT || 3000;

// Middleware
app.use(cors());
app.use(json());

initializeDatabase();

startEventScheduler();

startPlaylistScheduler();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/playlists', playlistRoutes);

// Serve static React frontend
const staticPath = '../../src/client/dist';
app.use(expressStatic(staticPath));

// Fallback to index.html for React routing
app.get('*', (req, res) => {
  res.sendFile('index.html', {root: staticPath});
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
