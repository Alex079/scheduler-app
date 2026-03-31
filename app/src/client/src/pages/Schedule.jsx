import { useState, useEffect } from 'react'
import { eventsAPI } from '../api/client'
import { localIsoMinutesToUnixSeconds, unixSecondsToLocalIsoMinutes } from '../utils/dates.js'
import PlaylistManager from './PlaylistManager'
import './Schedule.css'

const PLAYLIST_SELECTOR = 'SELECTOR'
const PLAYLIST_MANAGER = 'MANAGER'

export default function Schedule({ username, onLogout }) {
  const [showPlaylist, setShowPlaylist] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    start_time: '',
    end_time: '',
    playlist_entry_id: null,
  })
  const [selectedPlaylistEntry, setSelectedPlaylistEntry] = useState(null)

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

  const handleSelectPlaylistEntry = (entry) => {
    setSelectedPlaylistEntry(entry)
    setFormData(prev => ({ ...prev, playlist_entry_id: entry.id }))
    setShowPlaylist(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name || !formData.start_time || !formData.end_time || !formData.playlist_entry_id) {
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
          formData.playlist_entry_id
        )
      } else {
        await eventsAPI.create(
          formData.name,
          start_time_unix,
          end_time_unix,
          formData.playlist_entry_id
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
      playlist_entry_id: event.playlist_entry_id,
    })
    if (event.playlist_entry_id) {
      setSelectedPlaylistEntry({
        id: event.playlist_entry_id,
        url: event.entry_url,
        title: event.entry_title,
      })
    } else {
      setSelectedPlaylistEntry(null)
    }
    setEditingId(event.id)
    setShowForm(true)
    setShowPlaylist(null)
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
      playlist_entry_id: null,
    })
    setSelectedPlaylistEntry(null)
    setEditingId(null)
    setShowForm(false)
    setShowPlaylist(null)
    setError('')
  }

  const showPlaylistManager = () => {
    setShowPlaylist(PLAYLIST_MANAGER);
  }

  const showPlaylistSelector = () => {
    setShowPlaylist(PLAYLIST_SELECTOR);
  }

  const hidePlaylist = () => {
    setShowPlaylist(null);
  }

  return (
    <div className="schedule-container">
      <div className="schedule-header">
        <div className="header-left">
          <h1>Scheduler</h1>
          <button
            className="schedule-header-playlist-btn"
            onClick={showPlaylistManager}
          >
            Playlists
          </button>
        </div>
        <div className="header-right-group">
          <p className="schedule-user-info">User: <strong>{username}</strong></p>
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

                {/* Playlist Entry Selection */}
                <div className="schedule-form-group">
                  <label>Playlist Entry</label>
                  {selectedPlaylistEntry ? (
                    <div className="schedule-playlist-selected">
                      <div className="schedule-playlist-selected-title">{selectedPlaylistEntry.title}</div>
                      <div className="schedule-playlist-selected-url">{selectedPlaylistEntry.url}</div>
                      <div className="schedule-playlist-selected-actions">
                        <button
                          type="button"
                          className="schedule-playlist-change-btn"
                          onClick={showPlaylistSelector}
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          className="schedule-playlist-clear-btn"
                          onClick={() => {
                            setSelectedPlaylistEntry(null)
                            setFormData(prev => ({ ...prev, playlist_entry_id: null }))
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
                      onClick={showPlaylistSelector}
                    >
                      Select Playlist Entry
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
            <p>⏳</p>
          ) : events.length === 0 ? (
            <p className="schedule-no-events">No events scheduled yet</p>
          ) : (
            <div className="schedule-events-list">
              {events.map(event => (
                <div key={event.id} className="schedule-event-card">
                  <div className="schedule-event-info">
                    <div className="event-header-row">
                      <h3>{event.name}</h3>
                      {event.recording_status && (
                        <p
                          title={event.recording_status.charAt(0).toUpperCase() + event.recording_status.slice(1)}
                          className={`recording-status recording-status-${event.recording_status}`}
                        >{(() => {
                          const durationSeconds = event.end_time - event.start_time;
                          const hours = Math.floor(durationSeconds / 3600);
                          const minutes = Math.floor((durationSeconds % 3600) / 60);
                          return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                        })()}
                        </p>)}
                    </div>
                    <div className="event-properties-row">
                      <p className="schedule-event-property">
                        <span className="time-label">Start:</span>{(() => {
                          const date = new Date(event.start_time * 1000);
                          return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        })()}
                      </p>
                      <p className="schedule-event-property">
                        <span className="time-label">End:</span>{(() => {
                          const date = new Date(event.end_time * 1000);
                          return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        })()}
                      </p>
                      <p className="schedule-event-property">
                        <span className="time-label">Stream:</span>
                        <a href={event.entry_url} target="_blank" rel="noopener noreferrer" title={event.entry_url}>
                          {event.entry_title || 'View'}
                        </a>
                      </p>
                    </div>
                    {event.recording_file && (
                      <p className="schedule-event-filename">
                        <span className="time-label">File:</span>
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

      {showPlaylist && (
        <PlaylistManager
          onEntrySelected={showPlaylist === PLAYLIST_SELECTOR ? handleSelectPlaylistEntry : null}
          onClose={hidePlaylist}
          onLogout={onLogout}
        />
      )}
    </div>
  )
}

