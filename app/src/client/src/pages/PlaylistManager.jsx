import { useState, useEffect } from 'react'
import { playlistAPI } from '../api/client'
import './PlaylistManager.css'
import { unixSecondsToLocalTime } from '../utils/dates'

export default function PlaylistManager({ onEntrySelected, onClose }) {
  const [playlists, setPlaylists] = useState([])
  const [entries, setEntries] = useState([])
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('')
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [addingPlaylist, setAddingPlaylist] = useState(false)

  useEffect(() => {
    loadPlaylists()
  }, [])

  const loadPlaylists = async () => {
    try {
      setLoading(true)
      const response = await playlistAPI.getPlaylists()
      setPlaylists(response.data)
      setError('')
    } catch (err) {
      setError('Failed to load playlists')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadEntries = async (playlistId) => {
    try {
      setLoading(true)
      const response = await playlistAPI.getEntries(playlistId)
      setEntries(response.data)
      setSelectedPlaylist(playlistId)
      setSelectedEntry(null)
      setError('')
    } catch (err) {
      setError('Failed to load entries')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddPlaylist = async (e) => {
    e.preventDefault()
    if (!newPlaylistUrl) {
      setError('URL is required')
      return
    }

    try {
      setAddingPlaylist(true)
      await playlistAPI.addPlaylist(newPlaylistUrl, newPlaylistName)
      setNewPlaylistUrl('')
      setNewPlaylistName('')
      await loadPlaylists()
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add playlist')
    } finally {
      setAddingPlaylist(false)
    }
  }

  const handleDeletePlaylist = async (id) => {
    if (!window.confirm('Delete this playlist and all its entries?')) return

    try {
      await playlistAPI.deletePlaylist(id)
      if (selectedPlaylist === id) {
        setSelectedPlaylist(null)
        setEntries([])
      }
      await loadPlaylists()
    } catch (err) {
      setError('Failed to delete playlist')
    }
  }

  const handleRefresh = async (id) => {
    try {
      await playlistAPI.refreshPlaylist(id)
      if (selectedPlaylist === id) {
        await loadEntries(id)
      }
      await loadPlaylists()
    } catch (err) {
      setError('Failed to refresh playlist')
    }
  }

  const handleSelectEntry = () => {
    if (selectedEntry) {
      const entry = entries.find(e => e.id === selectedEntry)
      if (entry) {
        onEntrySelected({
          id: entry.id,
          url: entry.entry_url,
          title: entry.title,
        })
      }
    }
  }

  return (
    <div className="playlist-modal">
      <div className="playlist-modal-content">
        <div className="playlist-modal-header">
          <h2>Playlists</h2>
          <p className="playlist-description">Manage your playlist URLs and entries</p>
          <button className="playlist-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="playlist-container">
          {/* Left: Playlists */}
          <div className="playlist-left">
            <div className="playlist-section-add">
              <h3>Add Playlist</h3>
              <form onSubmit={handleAddPlaylist} className="playlist-add-form">
                <input
                  required
                  type="url"
                  value={newPlaylistUrl}
                  onChange={(e) => setNewPlaylistUrl(e.target.value)}
                  placeholder="Playlist URL"
                  disabled={addingPlaylist}
                />
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Playlist name (optional)"
                  disabled={addingPlaylist}
                />
                <button type="submit" disabled={addingPlaylist || !newPlaylistUrl}>
                  {addingPlaylist ? '⏳' : 'Add'}
                </button>
              </form>
            </div>

            {/* Playlists List */}
            <div className="playlist-section-list">
              <h3>Your Playlists ({playlists.length})</h3>
              <div className="playlist-list">
                {loading && playlists.length === 0 && <p>Loading...</p>}
                {playlists.length === 0 ? (
                  <p className="playlist-empty-message">No playlists</p>
                ) : (
                  playlists.map(p => (
                    <div
                      key={p.id}
                      className={`playlist-item ${selectedPlaylist === p.id ? 'active' : ''}`}
                    >
                      <div onClick={() => loadEntries(p.id)} className="playlist-info">
                        <div className="playlist-name">{p.name}</div>
                        <div className="playlist-url" title={p.url}>{p.url}</div>
                        <div className="playlist-meta">
                          Last refresh: {unixSecondsToLocalTime(p.last_refreshed)}
                        </div>
                      </div>
                      <div className="playlist-actions">
                        <button
                          className="playlist-refresh-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRefresh(p.id)
                          }}
                          title="Refresh"
                        >
                          ↻
                        </button>
                        <button
                          className="playlist-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePlaylist(p.id)
                          }}
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Entries */}
          <div className="playlist-right">
            <h3>Entries {selectedPlaylist && `(${entries.length})`}</h3>
            {selectedPlaylist ? (
              <>
                <div className="playlist-entries-list">
                  {loading && <p>Loading...</p>}
                  {entries.length === 0 ? (
                    <p className="playlist-empty-message">No entries</p>
                  ) : (
                    entries.map(e => (
                      <div
                        key={e.id}
                        className={`playlist-entry-item ${onEntrySelected && (selectedEntry === e.id) ? 'active' : ''}`}
                        onClick={() => setSelectedEntry(e.id)}
                      >
                        {e.logo && (
                          <img src={e.logo} alt="" className="playlist-entry-logo" onError={(e) => e.target.style.display = 'none'} />
                        )}
                        <div className="playlist-entry-content">
                          <div className="playlist-entry-title">{e.title || 'Untitled'}</div>
                          <div className="playlist-entry-url" title={e.entry_url}>{e.entry_url}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {selectedEntry && onEntrySelected && (
                  <div className="playlist-entry-actions">
                    <button className="playlist-entry-select-btn" onClick={handleSelectEntry}>
                      Select Entry
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="playlist-empty-message">Select a playlist to view its entries</p>
            )}
          </div>
        </div>

        {error && <div className="playlist-error-message">{error}</div>}
      </div>
    </div>
  )
}
