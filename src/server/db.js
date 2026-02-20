const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../../scheduler.db');
const db = new sqlite3.Database(dbPath);

function initializeDatabase() {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
    )
  `);

  // Create events table
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      m3u_entry_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
      recording_file TEXT,
      recording_status TEXT,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (m3u_entry_id) REFERENCES m3u_entries(id)
    )
  `);

  // Create M3U playlists table
  db.run(`
    CREATE TABLE IF NOT EXISTS m3u_playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      name TEXT,
      last_refreshed INTEGER,
      created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
    )
  `);

  // Create M3U entries table (parsed URLs from playlists)
  db.run(`
    CREATE TABLE IF NOT EXISTS m3u_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      entry_url TEXT NOT NULL,
      title TEXT,
      logo TEXT,
      created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
      FOREIGN KEY (playlist_id) REFERENCES m3u_playlists(id) ON DELETE CASCADE
    )
  `);

  // Seed admin users if they don't exist
  seedUsers();
  
  // Start daily M3U refresh job
  require('./services/m3u-refresher').startDailyRefresh(db);
  
  // Start event scheduler for FFmpeg recordings
  require('./services/event-runner').startEventScheduler(db);
}

function seedUsers() {
  const users = [
    { username: 'alice', password: 'password123' },
    { username: 'bob', password: 'password456' },
    { username: 'charlie', password: 'password789' }
  ];

  users.forEach(user => {
    db.get('SELECT id FROM users WHERE username = ?', [user.username], (err, row) => {
      if (!row) {
        const hashedPassword = bcrypt.hashSync(user.password, 10);
        db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', 
          [user.username, hashedPassword],
          (err) => {
            if (err) {
              console.error(`Error seeding user ${user.username}:`, err);
            } else {
              console.log(`Seeded user: ${user.username}`);
            }
          }
        );
      }
    });
  });
}

function getDatabase() {
  return db;
}

module.exports = { initializeDatabase, getDatabase };
