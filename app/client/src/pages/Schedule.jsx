import { useEffect, useState } from 'react'
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

  const handleResponse = (response) => {
    setError('')
    setEvents(response.data)
  }

  const handleError = (err) => {
    setError(`Failed to load events ${err}`)
    if (err.status === 401) onLogout()
  }

  const loadEvents = () => eventsAPI.getAll()
    .then(handleResponse)
    .catch(handleError)
    .finally(() => {setLoading(false);})

  const reloadEvents = () => {
    setLoading(true)
    return loadEvents()
  }

  useEffect(() => {loadEvents()}, [])

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
    return eventsAPI.delete(id)
      .then(reloadEvents)
      .catch(handleError)
  }

  const showPlaylistManager = () => setShowPlaylist(PLAYLIST_MANAGER)

  return (
    <div className="schedule-container">
      <ScheduleHeader username={username} onLogout={onLogout} onOpenPlaylists={showPlaylistManager} />

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
              onSubmit={() => { resetForm(false); reloadEvents(); }}
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

      {showPlaylist && (
        <PlaylistManager onClose={() => setShowPlaylist(null)} onLogout={onLogout} />
      )}
    </div>
  )
}
