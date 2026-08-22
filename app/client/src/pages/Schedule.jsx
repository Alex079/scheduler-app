import { useState, useEffect } from 'react'
import { eventsAPI } from '../api/client'
import PlaylistManager from './PlaylistManager'
import ScheduleHeader from '../components/ScheduleHeader'
import EventFormCard from '../components/EventFormCard'
import EventList from '../components/EventList'
import './Schedule.css'

const PLAYLIST_MANAGER = 'MANAGER'

export default function Schedule({ username, onLogout }) {
  const [showPlaylist, setShowPlaylist] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)

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

  const resetForm = (show) => {
    setEditingEvent(null)
    setShowPlaylist(null)
    setShowForm(show)
  }

  const handleEdit = (event) => {
    setEditingEvent(event)
    setShowPlaylist(null)
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
      if (err.status === 401) onLogout()
    }
  }

  const showPlaylistManager = () => setShowPlaylist(PLAYLIST_MANAGER)

  return (
    <div className="schedule-container">
      <ScheduleHeader username={username} onLogout={onLogout} onOpenPlaylists={showPlaylistManager} />

      {showPlaylist ? (
        <PlaylistManager onClose={() => setShowPlaylist(null)} onLogout={onLogout} />
      ) : (
        <>
          <div className="schedule-content">
            <div className="schedule-sidebar">
              <button
                className="schedule-new-event-btn"
                onClick={() => { resetForm(true); }}
              >
                + New Event
              </button>

              {showForm && (
                <EventFormCard
                  key={editingEvent?.id ?? 'new'}
                  initialEvent={editingEvent?.id ? editingEvent : null}
                  onSubmit={() => { resetForm(false); loadEvents(); }}
                  onClose={() => { resetForm(false); }}
                />
              )}
            </div>

            <div className="schedule-main">
              <h2>Shared Schedule</h2>
              {error && <div className="schedule-error-message">{error}</div>}
              <EventList events={events} isLoading={loading} onEdit={handleEdit} onDelete={handleDelete} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
