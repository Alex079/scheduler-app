import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';

// __dirname is unavailable under "type": "module"; derive the module's absolute
// path from the import meta URL so paths resolve against this file, not cwd.
const moduleUrl = import.meta.url;
const DATABASE_DIR = resolve(fileURLToPath(moduleUrl), '../../database');

// Ensure db directory exists
if (!existsSync(DATABASE_DIR)) {
  mkdirSync(DATABASE_DIR, { recursive: true });
}

const db = new Database(join(DATABASE_DIR, 'scheduler.db'));

export function initializeDatabase() {
  db.pragma(`foreign_keys = ON`);
  db.pragma('journal_mode = WAL');
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
    )
  `);

  // Create playlists table
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      name TEXT,
      last_refreshed INTEGER,
      created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
    )
  `);

  // Create Playlist entries table (parsed URLs from playlists)
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlist_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER,
      entry_url TEXT NOT NULL,
      title TEXT,
      logo TEXT,
      created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE SET NULL
    )
  `);

  // Create events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      playlist_entry_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
      recording_file TEXT,
      recording_status TEXT,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (playlist_entry_id) REFERENCES playlist_entries(id)
    )
  `);

  // Index for join lookups and diff-based refresh comparisons
  db.exec(`CREATE INDEX IF NOT EXISTS idx_playlist_entries_url ON playlist_entries (entry_url)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_playlist_entries_playlist ON playlist_entries (playlist_id)`);

  // Seed admin users if they don't exist
  const users = process.env.USERS?.split(',').map(cred => {
    const [username, password] = cred.split(':');
    return { username, password };
  }) || [];
  seedUsers(users);
}

function seedUsers(users) {
  users.forEach(user => {
    const row = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);
    if (!row) {
      db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
        .run(user.username, bcrypt.hashSync(user.password, 10));
    }
  });
}

export function login(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  return (user && bcrypt.compareSync(password, user.password_hash)) ? user.id : null;
}

export function getAllEvents() {
  return db
    .prepare(
      `SELECT 
        e.id, 
        e.name, 
        e.start_time, 
        e.end_time, 
        e.playlist_entry_id,
        e.created_by,
        e.created_at,
        e.recording_file,
        e.recording_status,
        m.entry_url,
        m.title as entry_title
      FROM events e
      INNER JOIN playlist_entries m ON e.playlist_entry_id = m.id
      ORDER BY e.start_time`)
    .all() || [];
}

export function createNewEvent(name, start_time, end_time, playlist_entry_id, created_by) {
  const id = db
    .prepare('INSERT INTO events (name, start_time, end_time, playlist_entry_id, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(name, start_time, end_time, playlist_entry_id, created_by)
    .lastInsertRowid;
  return { id, name, start_time, end_time, playlist_entry_id, created_by };
}

export function updateEvent(id, name, start_time, end_time, playlist_entry_id) {
  const changes = db
    .prepare('UPDATE events SET name = ?, start_time = ?, end_time = ?, playlist_entry_id = ?, recording_status = NULL WHERE id = ?')
    .run(name, start_time, end_time, playlist_entry_id, id)
    .changes;
  return (changes === 0) ? null : { id, name, start_time, end_time, playlist_entry_id };
}

/**
 * Delete an event by id. Returns the number of affected rows (0 if nothing
 * matched / the event did not exist); callers treat 0 as "not found".
 */
export function deleteEventById(id) {
  return db.prepare('DELETE FROM events WHERE id = ?').run(id).changes === 0;
}

export function getUpcomingEvents() {
  const oneDayInSeconds = 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  return db
    .prepare(
      `SELECT 
        e.id, 
        e.name, 
        e.start_time, 
        e.end_time,
        m.entry_url,
        m.title as entry_title
      FROM events e
      INNER JOIN playlist_entries m ON e.playlist_entry_id = m.id
      WHERE e.start_time > ? AND e.start_time <= ? AND e.recording_status IS NULL
      ORDER BY e.start_time`)
    .all(now, now + oneDayInSeconds) || [];
}

export function getAllScheduledEvents() {
  return db
    .prepare(
      `SELECT 
        e.id, 
        e.name, 
        e.start_time, 
        e.end_time,
        m.entry_url,
        m.title as entry_title
      FROM events e
      INNER JOIN playlist_entries m ON e.playlist_entry_id = m.id
      WHERE e.recording_status = 'scheduled'
      ORDER BY e.start_time`)
    .all() || [];
}


export function eventScheduled(id) {
  db.prepare('UPDATE events SET recording_status = ? WHERE id = ?').run('scheduled', id);
}

export function eventStarted(id, filename) {
  db.prepare('UPDATE events SET recording_status = ?, recording_file = ? WHERE id = ?').run('started', filename, id);
}

export function eventCompleted(id) {
  db.prepare('UPDATE events SET recording_status = ? WHERE id = ?').run('completed', id);
}

export function eventFailed(id) {
  db.prepare('UPDATE events SET recording_status = ? WHERE id = ?').run('failed', id);
}

export function eventMissed(id) {
  db.prepare('UPDATE events SET recording_status = ? WHERE id = ?').run('missed', id);
}

/**
 * Mark events that were never scheduled (e.g. the server was down at their start
 * time) as missed, so they don't stay in an indeterminate state forever.
 * @returns {number} Number of events marked as missed
 */
export function markMissedPastEvents() {
  return db
    .prepare(`UPDATE events SET recording_status = 'missed' WHERE recording_status IS NULL AND start_time <= ?`)
    .run(Math.floor(Date.now() / 1000)).changes;
}

export function getAllPlaylists() {
  return db.prepare('SELECT id, name, url, COALESCE(last_refreshed, 0) AS last_refreshed FROM playlists').all() || [];
}

export function getPlaylistById(id) {
  return db.prepare('SELECT id, name, url FROM playlists WHERE id = ?').get(id);
}

export function getAllOutdatedPlaylists() {
  return db
    .prepare(`
      SELECT id, name, url FROM playlists
      WHERE COALESCE(last_refreshed, 0) < (CAST(strftime('%s', 'now') AS INTEGER) - 86400)`)
    .all() || [];
}

export function createNewPlaylist(url, name) {
  const id = db
    .prepare('INSERT INTO playlists (url, name) VALUES (?, ?)')
    .run(url, name)
    .lastInsertRowid;
  return { id, url, name };
}

export function deletePlaylist(playlistId) {
  const removePlaylist = db.transaction(() => {
    // Remove entries that are no longer in use. Entries referenced by an event are
    // kept (their playlist_id is nulled by the ON DELETE SET NULL foreign key) so
    // existing events remain valid.
    db.prepare(`
      DELETE FROM playlist_entries
      WHERE playlist_id = ? AND id NOT IN (SELECT playlist_entry_id FROM events)`)
      .run(playlistId);
    return db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId).changes;
  });
  const changes = removePlaylist();
  return (changes === 0) ? { message: 'Playlist not found' } : { message: 'Playlist deleted' };
}

export function getPlaylistEntries(playlistId) {
  return db
    .prepare('SELECT id, entry_url, title, logo FROM playlist_entries WHERE playlist_id = ?')
    .all(playlistId) || [];
}

export function getPlaylistEntryById(id) {
  return db.prepare('SELECT id FROM playlist_entries WHERE id = ?').get(id);
}

/**
 * Fetch a single event by id, including its current recording status.
 * Used by the update/delete handlers to refuse mutating an event that is
 * currently being recorded.
 */
export function getEventById(id) {
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id);
}

/**
 * Close the SQLite connection so the WAL can flush and the process can
 * exit cleanly (see graceful shutdown in server.js).
 */
export function closeDatabase() {
  try {
    db.close();
  } catch (err) {
    console.error(`Failed to close database: ${err.message}`);
  }
}

export function updatePlaylistEntries(playlistId, entriesToAdd, entriesToUpdate, entriesToDelete) {
  const applyChanges = db.transaction(() => {
    if (entriesToDelete.length > 0) {
      const placeholders = entriesToDelete.map(() => '?').join(',');
      // Never delete entries still referenced by an event: events.playlist_entry_id
      // is NOT NULL with a RESTRICT foreign key, so the delete would fail and abort
      // the whole refresh. Keeping them lets scheduled/historical events stay valid.
      db.prepare(`
        DELETE FROM playlist_entries
        WHERE playlist_id = ? AND id IN (${placeholders})
          AND id NOT IN (SELECT playlist_entry_id FROM events)`)
        .run(playlistId, ...entriesToDelete);
    }
    const updateStmt = db.prepare('UPDATE playlist_entries SET title = ?, logo = ? WHERE playlist_id = ? AND entry_url = ?');
    entriesToUpdate.forEach(entry => {
      updateStmt.run(entry.title, entry.logo, playlistId, entry.url);
    });
    const insertStmt = db.prepare('INSERT INTO playlist_entries (title, logo, playlist_id, entry_url) VALUES (?, ?, ?, ?)');
    entriesToAdd.forEach(entry => {
      insertStmt.run(entry.title, entry.logo, playlistId, entry.url);
    });
    db.prepare('UPDATE playlists SET last_refreshed = CAST(strftime(\'%s\', \'now\') AS INTEGER) WHERE id = ?').run(playlistId);
  });
  applyChanges();
}
