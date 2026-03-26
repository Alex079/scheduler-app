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
