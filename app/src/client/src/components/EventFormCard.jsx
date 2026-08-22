import { useState } from 'react'
import PlaylistManager from '../pages/PlaylistManager'
import { eventsAPI } from '../api/client'

export default function EventFormCard({ initialEvent, onSubmit, onClose }) {
  const isEditing = !!initialEvent
  const [error, setError] = useState('')

  const unixSecondsToLocalIsoString = (unixSeconds) => {
    if (!unixSeconds) return '';
    const date = new Date(unixSeconds * 1000);
    const offset = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date - offset).toISOString().split('.', 1)[0];
  };

  const localIsoStringToUnixSeconds = (localIsoString) => {
    if (!localIsoString) return null;
    return Math.floor(new Date(localIsoString) / 1000);
  };

  const [formData, setFormData] = useState(
    initialEvent ? {
      name: initialEvent.name,
      start_time: unixSecondsToLocalIsoString(initialEvent.start_time),
      end_time: unixSecondsToLocalIsoString(initialEvent.end_time),
      playlist_entry_id: initialEvent.playlist_entry_id || null,
    } : { name: '', start_time: '', end_time: '', playlist_entry_id: null }
  )

  const [showPlaylist, setShowPlaylist] = useState(false)
  const [selectedPlaylistEntry, setSelectedPlaylistEntry] = useState(
    initialEvent?.playlist_entry_id
      ? { id: initialEvent.playlist_entry_id, url: initialEvent.entry_url, title: initialEvent.entry_title }
      : null
  )

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name || !formData.start_time || !formData.end_time || !formData.playlist_entry_id) {
      setError('All fields are required')
      return
    }

    try {
      if (isEditing) {
        await eventsAPI.update(
          initialEvent.id,
          formData.name,
          localIsoStringToUnixSeconds(formData.start_time),
          localIsoStringToUnixSeconds(formData.end_time),
          formData.playlist_entry_id
        )
      } else {
        await eventsAPI.create(
          formData.name,
          localIsoStringToUnixSeconds(formData.start_time),
          localIsoStringToUnixSeconds(formData.end_time),
          formData.playlist_entry_id
        )
      }
      setError('')
      onSubmit()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save event')
    }
  }

  const handleCancel = () => {
    setError('')
    onClose()
  }

  return (
    <div className="schedule-form-box">
      <h2>{isEditing ? 'Edit Event' : 'Create Event'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="schedule-form-group">
          <label htmlFor="name">Event Name</label>
          <input required id="name" type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g., Team Meeting" />
        </div>
        <div className="schedule-form-group">
          <label htmlFor="start_time">Start Time</label>
          <input required id="start_time" type="datetime-local" name="start_time" value={formData.start_time} onChange={handleInputChange} />
        </div>
        <div className="schedule-form-group">
          <label htmlFor="end_time">End Time</label>
          <input required id="end_time" type="datetime-local" name="end_time" value={formData.end_time} onChange={handleInputChange} />
        </div>

        {/* Playlist Entry Selection */}
        <div className="schedule-form-group">
          <label>Playlist Entry</label>
          {selectedPlaylistEntry ? (
            <div className="schedule-playlist-selected">
              <div className="schedule-playlist-selected-title">{selectedPlaylistEntry.title}</div>
              <div className="schedule-playlist-selected-url">{selectedPlaylistEntry.url}</div>
              <div className="schedule-playlist-selected-actions">
                <button type="button" className="schedule-playlist-change-btn" onClick={() => setShowPlaylist(true)}>Change</button>
                <button type="button" className="schedule-playlist-clear-btn" onClick={() => { setSelectedPlaylistEntry(null); setFormData(prev => ({ ...prev, playlist_entry_id: null })) }}>Clear</button>
              </div>
            </div>
          ) : (
            <button type="button" className="schedule-playlist-select-btn" onClick={() => setShowPlaylist(true)}>Select Playlist Entry</button>
          )}
        </div>

        {error && <div className="schedule-error-message">{error}</div>}
        <div className="schedule-form-buttons">
          <button type="submit">{isEditing ? 'Update' : 'Create'}</button>
          <button type="button" onClick={handleCancel} className="schedule-cancel-btn">Cancel</button>
        </div>
      </form>

      {showPlaylist && (
        <PlaylistManager onEntrySelected={(entry) => { setSelectedPlaylistEntry(entry); setFormData(prev => ({ ...prev, playlist_entry_id: entry.id })); setShowPlaylist(false) }} onClose={() => setShowPlaylist(false)} />
      )}
    </div>
  )
}
