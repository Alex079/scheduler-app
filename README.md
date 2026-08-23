# Scheduler App

A full-stack web application for managing playlists, schedules, and events with automated recording using FFmpeg. Features user authentication, playlist management, schedule creation, and backend services for event execution and playlist refreshing.

## 📋 Features
- User authentication (no registration)
- Playlist management (create, refresh, delete)
- Schedule events for automated recording
- Responsive React frontend
- Persistent data storage
- Dockerized deployment

## 🛠️ Tech Stack
- **Frontend**: React (Vite), JSX, CSS modules
- **Backend**: Node.js, Express
- **Database**: SQLite
- **Media Processing**: FFmpeg
- **Containerization**: Docker, Docker Compose
- **API**: RESTful endpoints for auth, events, playlists

## 🏃 Quick Start
- Start services:
   ```
   docker compose up -d
   ```
- Access the app: http://localhost:3000 (admin / admin123)

## Architecture

The app is made of three coordinated services, wired together with a named FIFO pipe:

```
┌──────────────────┐        /pipe          ┌──────────────┐
│  scheduler-app   │ <─ request/response ─>│  ffmpeg-app  │
│  (Node/Express)  │    FIFO (named pipe)  │  (FFmpeg)    │
│                  │                       └──────┬───────┘
│  • API + auth    │                              │ recordings
│  • event sched   │                              ▼
│  • playlist      │                    ./recordings (host volume)
│    refresher     │
└─────────┬────────┘
          │ scheduler.db (SQLite)
          ▼
   ./database (host volume)
```

- **`app/`** — the Node.js/Express server. It serves the built React client, exposes the REST API, and runs two background schedulers:
  - **Event runner** (`services/event-runner.js`): polls every minute for events starting in the next 24h, schedules each with a `setTimeout`, and writes a recording command to `/pipe/request`. It reads completion results back from `/pipe/response` and updates the recording status in the DB.
  - **Playlist refresher** (`services/playlist-refresher.js`): periodically refreshes playlists that haven't been updated in the last 24h.
- **`ffmpeg-app/`** — a small FFmpeg service (runs in `host` network mode) that consumes recording commands from the pipe and writes `.mp4` files to `/recordings`.
- **`database/`** — SQLite database, persisted to the host via a named volume.

## ⚙️ Configuration

Configuration is done entirely through environment variables in `docker-compose.yaml`:

| Variable | Default | Description |
| --- | --- | --- |
| `USERS` | `admin:admin123` | Comma-separated `username:password` pairs. Seeded into the DB on startup. |
| `JWT_SECRET` | random UUID | Signs 24h auth tokens. **Recommended to set explicitly in production.** |
| `APP_PORT` | `3000` | Port the server listens on. |

### Ports & Volumes

| Target | Host | Purpose |
| --- | --- | --- |
| `scheduler-app` | `3000` | Web app + API |
| `ffmpeg-app` | `host` network | FFmpeg recording |
| `./database` | `scheduler-app` volume | SQLite persistence |
| `./recordings` | `ffmpeg-app` volume | Recorded `.mp4` files |

## 🔌 API

All endpoints except `POST /api/auth/login` require a JWT bearer token (`Authorization: Bearer <token>`); a missing or invalid token returns `401`.

### Auth
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | No | Logs in with `username` + `password`; returns `{ token, userId, username }`. |

### Events
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/events` | Yes | List all events (joined with playlist stream data). |
| POST | `/api/events` | Yes | Create an event. |
| PUT | `/api/events/:id` | Yes | Update an event. |
| DELETE | `/api/events/:id` | Yes | Delete an event. |

### Playlists
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/playlists` | Yes | List all playlists. |
| GET | `/api/playlists/:id` | Yes | List entries in a playlist. |
| POST | `/api/playlists` | Yes | Create a playlist. |
| DELETE | `/api/playlists/:id` | Yes | Delete a playlist. |
| POST | `/api/playlists/:id` | Yes | Refresh a playlist. |

## 🗄️ Database Schema

SQLite tables created on startup:

- **`users`** — `id`, `username` (unique), `password_hash` (bcrypt), `created_at`
- **`playlists`** — `id`, `url` (unique), `name`, `last_refreshed`, `created_at`
- **`playlist_entries`** — `id`, `playlist_id` (FK), `entry_url`, `title`, `logo`, `created_at` (indexed by `entry_url` and `playlist_id`)
- **`events`** — `id`, `name`, `start_time`, `end_time`, `playlist_entry_id` (FK), `created_by` (FK), `created_at`, `recording_file`, `recording_status` (one of `scheduled` / `started` / `completed` / `failed` / `missed`)

## 🧭 Project Structure

```
.
├── docker-compose.yaml
├── app/
│   ├── Dockerfile
│   ├── server/
│   │   ├── server.js
│   │   ├── db/db.js
│   │   ├── handlers/      # business logic
│   │   ├── routes/        # Express routers
│   │   └── services/      # event-runner, playlist-refresher
│   └── client/
│       ├── vite.config.js
│       └── src/
│           ├── App.jsx, index.jsx
│           ├── api/client.js
│           ├── pages/     # Login, Schedule, PlaylistManager
│           └── components/
├── ffmpeg-app/
│   ├── Dockerfile
│   ├── entrypoint.sh      # sets up the /pipe FIFO
│   └── ffmpeg-runner.sh   # runs one ffmpeg record job
├── database/              # SQLite persistence (git-ignored)
└── recordings/            # recorded .mp4 files (git-ignored)
```

## Development

Run from within the `app` directory (that is the Docker build context):

```bash
cd app
npm install
npm start            # server on port 3000
```

Frontend dev server (requires a running server, or set a proxy in `vite.config.js`):

```bash
cd app/client
npm install
npm run dev
```
