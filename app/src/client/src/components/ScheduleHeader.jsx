export default function ScheduleHeader({ username, onLogout, onOpenPlaylists }) {
  return (
    <div className="schedule-header">
      <div className="header-left">
        <h1>Scheduler</h1>
        <button
          className="schedule-header-playlist-btn"
          onClick={onOpenPlaylists}
        >
          Playlists
        </button>
      </div>
      <div className="header-right-group">
        <p className="schedule-user-info">User: <strong>{username}</strong></p>
        <button className="schedule-logout-btn" onClick={onLogout}>Logout</button>
      </div>
    </div>
  )
}
