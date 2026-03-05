import { useState, useEffect } from 'react'
import { eventsAPI } from '../api/client'
import M3UPlaylists from './M3UPlaylists'
import PlaylistsManager from './PlaylistsManager'
import './Schedule.css'

// Convert Unix timestamp (seconds) to datetime-local format for input field
const unixToDatetimeLocal = (unixSeconds) => {
  if (!unixSeconds) return ''
  const date = new Date(unixSeconds * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Convert datetime-local format to Unix timestamp (seconds) for API
const datetimeLocalToUnix = (localString) => {
  if (!localString) return null
  const date = new Date(`${localString}:00`)
  return Math.floor(date.getTime() / 1000)
}

export default function Schedule({ username, onLogout }) {
  const [activeTab, setActiveTab] = useState('schedule') // 'schedule' or 'playlists'
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
      const start_time_unix = datetimeLocalToUnix(formData.start_time)
      const end_time_unix = datetimeLocalToUnix(formData.end_time)

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
    }
  }

  const handleEdit = (event) => {
    setFormData({
      name: event.name,
      // Convert Unix timestamp to local datetime-local format for editing
      start_time: unixToDatetimeLocal(event.start_time),
      end_time: unixToDatetimeLocal(event.end_time),
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

  const formatDateTime = (unixSeconds) => {
    if (!unixSeconds) return 'N/A'
    return new Date(unixSeconds * 1000).toLocaleString()
  }

  return (
    <div className="schedule-container">
      <div className="schedule-header">
        <div>
          <h1>Scheduler</h1>
          <p className="user-info">Logged in as: <strong>{username}</strong></p>
        </div>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </div>

      {/* Tabs */}
      <div className="tabs-header">
        <button
          className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          Schedule
        </button>
        <button
          className={`tab-btn ${activeTab === 'playlists' ? 'active' : ''}`}
          onClick={() => setActiveTab('playlists')}
        >
          M3U Playlists
        </button>
      </div>

      <div className="schedule-content">
        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <>
            <div className="schedule-sidebar">
              <button
                className="new-event-btn"
                onClick={() => {
                  resetForm()
                  setShowForm(true)
                }}
              >
                + New Event
              </button>

              {showForm && (
                <div className="form-box">
                  <h2>{editingId ? 'Edit Event' : 'Create Event'}</h2>
                  <form onSubmit={handleSubmit}>
                    <div className="form-group">
                      <label htmlFor="name">Event Name</label>
                      <input
                        id="name"
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="e.g., Team Meeting"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="start_time">Start Time</label>
                      <input
                        id="start_time"
                        type="datetime-local"
                        name="start_time"
                        value={formData.start_time}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="end_time">End Time</label>
                      <input
                        id="end_time"
                        type="datetime-local"
                        name="end_time"
                        value={formData.end_time}
                        onChange={handleInputChange}
                      />
                    </div>

                    {/* M3U Entry Selection */}
                    <div className="form-group">
                      <label>M3U Entry</label>
                      {selectedM3UEntry ? (
                        <div className="m3u-selected">
                          <div className="m3u-selected-title">{selectedM3UEntry.title}</div>
                          <div className="m3u-selected-url">{selectedM3UEntry.url}</div>
                          <div className="m3u-selected-actions">
                            <button
                              type="button"
                              className="m3u-change-btn"
                              onClick={() => setShowM3UModal(true)}
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              className="m3u-clear-btn"
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
                          className="m3u-select-btn"
                          onClick={() => setShowM3UModal(true)}
                        >
                          Select M3U Entry
                        </button>
                      )}
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    <div className="form-buttons">
                      <button type="submit">{editingId ? 'Update' : 'Create'}</button>
                      <button type="button" onClick={resetForm} className="cancel-btn">Cancel</button>
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
                <p className="no-events">No events scheduled yet</p>
              ) : (
                <div className="events-list">
                  {events.map(event => (
                    <div key={event.id} className="event-card">
                      <div className="event-info">
                        <h3>{event.name}</h3>
                        <p className="event-time">
                          <span className="time-label">Start:&nbsp;</span>{formatDateTime(event.start_time)}
                        </p>
                        <p className="event-time">
                          <span className="time-label">End:&nbsp;</span>{formatDateTime(event.end_time)}
                        </p>
                        {event.entry_url && (
                          <p className="event-m3u">
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
                          <p className="event-filename">
                            <span className="time-label">File:&nbsp;</span>
                            <span title={event.recording_file}>{event.recording_file}</span>
                          </p>
                        )}
                      </div>
                      <div className="event-actions">
                        <button 
                          className="edit-btn" 
                          onClick={() => handleEdit(event)}
                          disabled={!isEventEditable(event)}
                          title={getEditButtonTitle(event)}
                        >
                          Edit
                        </button>
                        <button className="delete-btn" onClick={() => handleDelete(event.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Playlists Tab */}
        {activeTab === 'playlists' && (
          <div className="playlists-tab-content">
            <PlaylistsManager />
          </div>
        )}
      </div>

      {showM3UModal && (
        <M3UPlaylists
          onEntrySelected={handleSelectM3UEntry}
          onClose={() => setShowM3UModal(false)}
        />
      )}
    </div>
  )
}
