import { useState, useEffect } from 'react'
import { eventsAPI } from '../api/client'
import { localIsoMinutesToUnixSeconds, unixSecondsToLocalTime, unixSecondsToLocalIsoMinutes } from '../utils/dates.js'
import PlaylistManager from './PlaylistManager'
import './Schedule.css'

export default function Schedule({ username, onLogout }) {
  const [showPlaylistManager, setShowPlaylistManager] = useState(false)

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showM3UModal, setShowM3UModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    start_time: '',
    end_time: '',
    m3u_entry_id: null,
  })
  const [selectedM3UEntry, setSelectedM3UEntry] = useState(null)

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      setLoading(true)
      const response = await eventsAPI.getAll()
      setEvents(response.data)
    } catch (err) {
      setError('Failed to load events')
      console.error(err)
      if (err.status === 401) onLogout()
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectM3UEntry = (entry) => {
    setSelectedM3UEntry(entry)
    setFormData(prev => ({ ...prev, m3u_entry_id: entry.id }))
    setShowM3UModal(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name || !formData.start_time || !formData.end_time || !formData.m3u_entry_id) {
      setError('All fields are required')
      return
    }

    try {
      // Convert local datetime to Unix timestamp before sending to API
      const start_time_unix = localIsoMinutesToUnixSeconds(formData.start_time)
      const end_time_unix = localIsoMinutesToUnixSeconds(formData.end_time)

      if (editingId) {
        await eventsAPI.update(
          editingId,
          formData.name,
          start_time_unix,
          end_time_unix,
          formData.m3u_entry_id
        )
      } else {
        await eventsAPI.create(
          formData.name,
          start_time_unix,
          end_time_unix,
          formData.m3u_entry_id
        )
      }
      resetForm()
      await loadEvents()
    } catch (err) {
      setError('Failed to save event')
      console.error(err)
      if (err.status === 401) onLogout()
    }
  }

  const handleEdit = (event) => {
    setFormData({
      name: event.name,
      // Convert Unix timestamp to local datetime-local format for editing
      start_time: unixSecondsToLocalIsoMinutes(event.start_time),
      end_time: unixSecondsToLocalIsoMinutes(event.end_time),
      m3u_entry_id: event.m3u_entry_id,
    })
    if (event.m3u_entry_id) {
      setSelectedM3UEntry({
        id: event.m3u_entry_id,
        url: event.entry_url,
        title: event.m3u_title,
      })
    } else {
      setSelectedM3UEntry(null)
    }
    setEditingId(event.id)
    setShowForm(true)
    setShowM3UModal(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return

    try {
      await eventsAPI.delete(id)
      await loadEvents()
    } catch (err) {
      setError('Failed to delete event')
      console.error(err)
      if (err.status === 401) onLogout()
    }
  }

  const isEventEditable = (event) => {
    const now = Math.floor(Date.now() / 1000)
    const nonEditableStatuses = ['started', 'completed', 'failed']
    // Not editable if: has non-editable status OR event has ended
    return !nonEditableStatuses.includes(event.recording_status) && event.end_time > now
  }

  const getEditButtonTitle = (event) => {
    const now = Math.floor(Date.now() / 1000)
    const nonEditableStatuses = ['started', 'completed', 'failed']
    if (nonEditableStatuses.includes(event.recording_status)) {
      return `Cannot edit: recording ${event.recording_status}`
    }
    if (event.end_time <= now) {
      return 'Cannot edit: event has ended'
    }
    return 'Edit event'
  }

  const resetForm = () => {
    setFormData({
      name: '',
      start_time: '',
      end_time: '',
      m3u_entry_id: null,
    })
    setSelectedM3UEntry(null)
    setEditingId(null)
    setShowForm(false)
    setShowM3UModal(false)
    setError('')
  }

  return (
    <div className="schedule-container">
      <div className="schedule-header">
        <div className="header-left">
          <h1>Scheduler</h1>
          <button
            className="schedule-header-playlist-btn"
            onClick={() => setShowPlaylistManager(true)}
          >
            Manage Playlists
          </button>
        </div>
        <div className="header-right-group">
          <p className="schedule-user-info">Logged in as: <strong>{username}</strong></p>
          <button className="schedule-logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="schedule-content">
        {/* Schedule content */}
        <div className="schedule-sidebar">

          <button
            className="schedule-new-event-btn"
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
          >
            + New Event
          </button>

          {showForm && (
            <div className="schedule-form-box">
              <h2>{editingId ? 'Edit Event' : 'Create Event'}</h2>
              <form onSubmit={handleSubmit}>
                <div className="schedule-form-group">
                  <label htmlFor="name">Event Name</label>
                  <input
                    required
                    id="name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Team Meeting"
                  />
                </div>
                <div className="schedule-form-group">
                  <label htmlFor="start_time">Start Time</label>
                  <input
                    required
                    id="start_time"
                    type="datetime-local"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="schedule-form-group">
                  <label htmlFor="end_time">End Time</label>
                  <input
                    required
                    id="end_time"
                    type="datetime-local"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleInputChange}
                  />
                </div>

                {/* M3U Entry Selection */}
                <div className="schedule-form-group">
                  <label>M3U Entry</label>
                  {selectedM3UEntry ? (
                    <div className="schedule-playlist-selected">
                      <div className="schedule-playlist-selected-title">{selectedM3UEntry.title}</div>
                      <div className="schedule-playlist-selected-url">{selectedM3UEntry.url}</div>
                      <div className="schedule-playlist-selected-actions">
                        <button
                          type="button"
                          className="schedule-playlist-change-btn"
                          onClick={() => setShowM3UModal(true)}
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          className="schedule-playlist-clear-btn"
                          onClick={() => {
                            setSelectedM3UEntry(null)
                            setFormData(prev => ({ ...prev, m3u_entry_id: null }))
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="schedule-playlist-select-btn"
                      onClick={() => setShowM3UModal(true)}
                    >
                      Select M3U Entry
                    </button>
                  )}
                </div>

                {error && <div className="schedule-error-message">{error}</div>}
                <div className="schedule-form-buttons">
                  <button type="submit">{editingId ? 'Update' : 'Create'}</button>
                  <button type="button" onClick={resetForm} className="schedule-cancel-btn">Cancel</button>
                </div>
              </form>
            </div>
          )}
        </div>

        <div className="schedule-main">

          <h2>Shared Schedule</h2>
          {loading ? (
            <p>Loading events...</p>
          ) : events.length === 0 ? (
            <p className="schedule-no-events">No events scheduled yet</p>
          ) : (
            <div className="schedule-events-list">
              {events.map(event => (
                <div key={event.id} className="schedule-event-card">
                  <div className="schedule-event-info">
                    <h3>{event.name}</h3>
                    <p className="schedule-event-time">
                      <span className="time-label">Start:&nbsp;</span>{unixSecondsToLocalTime(event.start_time)}
                    </p>
                    <p className="schedule-event-time">
                      <span className="time-label">End:&nbsp;</span>{unixSecondsToLocalTime(event.end_time)}
                    </p>
                    {event.entry_url && (
                      <p className="schedule-event-playlist-entry">
                        <span className="time-label">Stream:&nbsp;</span>
                        <a href={event.entry_url} target="_blank" rel="noopener noreferrer" title={event.entry_url}>
                          {event.m3u_title || 'View'}
                        </a>
                      </p>
                    )}
                    {event.recording_status && (
                      <div className="recording-status-container">
                        <span className="time-label">Recording:&nbsp;</span>
                        <span className={`recording-status recording-status-${event.recording_status}`}>
                          {event.recording_status.charAt(0).toUpperCase() + event.recording_status.slice(1)}
                        </span>
                      </div>
                    )}
                    {event.recording_file && (
                      <p className="schedule-event-filename">
                        <span className="time-label">File:&nbsp;</span>
                        <span title={event.recording_file}>{event.recording_file}</span>
                      </p>
                    )}
                  </div>
                  <div className="schedule-event-actions">
                    <button
                      className="schedule-edit-btn"
                      onClick={() => handleEdit(event)}
                      disabled={!isEventEditable(event)}
                      title={getEditButtonTitle(event)}
                    >
                      Edit
                    </button>
                    <button className="schedule-delete-btn" onClick={() => handleDelete(event.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showM3UModal && (
        <PlaylistManager
          onEntrySelected={handleSelectM3UEntry}
          onClose={() => setShowM3UModal(false)}
        />
      )}
      {showPlaylistManager && (
        <PlaylistManager onClose={() => setShowPlaylistManager(false)} />
      )}
    </div>
  )
}

