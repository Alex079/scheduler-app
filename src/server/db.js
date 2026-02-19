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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create events table
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Seed admin users if they don't exist
  seedUsers();
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
