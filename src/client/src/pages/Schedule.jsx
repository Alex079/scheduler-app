import { useState, useEffect } from 'react'
import { eventsAPI } from '../api/client'
import './Schedule.css'

export default function Schedule({ username, onLogout }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    start_time: '',
    end_time: '',
  })

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

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name || !formData.start_time || !formData.end_time) {
      setError('All fields are required')
      return
    }

    try {
      if (editingId) {
        await eventsAPI.update(editingId, formData.name, formData.start_time, formData.end_time)
      } else {
        await eventsAPI.create(formData.name, formData.start_time, formData.end_time)
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
      start_time: event.start_time,
      end_time: event.end_time,
    })
    setEditingId(event.id)
    setShowForm(true)
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

  const resetForm = () => {
    setFormData({ name: '', start_time: '', end_time: '' })
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString()
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

      <div className="schedule-content">
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
                      <span className="time-label">Start:</span> {formatDateTime(event.start_time)}
                    </p>
                    <p className="event-time">
                      <span className="time-label">End:</span> {formatDateTime(event.end_time)}
                    </p>
                  </div>
                  <div className="event-actions">
                    <button className="edit-btn" onClick={() => handleEdit(event)}>Edit</button>
                    <button className="delete-btn" onClick={() => handleDelete(event.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
