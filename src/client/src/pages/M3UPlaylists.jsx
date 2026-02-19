import { useState, useEffect } from 'react'
import { m3uAPI } from '../api/client'
import './M3UPlaylists.css'

export default function M3UPlaylists({ onEntrySelected, onClose }) {
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
      const response = await m3uAPI.getPlaylists()
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
      const response = await m3uAPI.getEntries(playlistId)
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
      await m3uAPI.addPlaylist(newPlaylistUrl, newPlaylistName)
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
      await m3uAPI.deletePlaylist(id)
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
      await m3uAPI.refreshPlaylist(id)
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
    <div className="m3u-modal">
      <div className="m3u-modal-content">
        <div className="m3u-modal-header">
          <h2>M3U Entries</h2>
          <button className="m3u-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="m3u-container">
          {/* Left: Playlists */}
          <div className="m3u-left">
            <h3>Playlists</h3>

            {/* Add Playlist Form */}
            <form onSubmit={handleAddPlaylist} className="m3u-add-form">
              <input
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
                placeholder="Name (optional)"
                disabled={addingPlaylist}
              />
              <button type="submit" disabled={addingPlaylist || !newPlaylistUrl}>
                {addingPlaylist ? 'Adding...' : 'Add'}
              </button>
            </form>

            {/* Playlists List */}
            <div className="m3u-list">
              {loading && <p>Loading...</p>}
              {playlists.length === 0 ? (
                <p className="m3u-empty">No playlists</p>
              ) : (
                playlists.map(p => (
                  <div
                    key={p.id}
                    className={`m3u-playlist-item ${selectedPlaylist === p.id ? 'active' : ''}`}
                  >
                    <div onClick={() => loadEntries(p.id)} className="m3u-playlist-info">
                      <div className="m3u-playlist-name">{p.name}</div>
                      <div className="m3u-playlist-meta">
                        {p.last_refreshed ? `Last: ${new Date(p.last_refreshed).toLocaleString()}` : 'Never'}
                      </div>
                    </div>
                    <div className="m3u-playlist-actions">
                      <button
                        className="m3u-refresh-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRefresh(p.id)
                        }}
                        title="Refresh"
                      >
                        ↻
                      </button>
                      <button
                        className="m3u-delete-btn"
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

          {/* Right: Entries */}
          <div className="m3u-right">
            <h3>Entries</h3>
            {selectedPlaylist ? (
              <>
                <div className="m3u-entries-list">
                  {loading && <p>Loading...</p>}
                  {entries.length === 0 ? (
                    <p className="m3u-empty">No entries</p>
                  ) : (
                    entries.map(e => (
                      <div
                        key={e.id}
                        className={`m3u-entry-item ${selectedEntry === e.id ? 'active' : ''}`}
                        onClick={() => setSelectedEntry(e.id)}
                      >
                        {e.logo && (
                          <img src={e.logo} alt="" className="m3u-entry-logo" onError={(e) => e.target.style.display = 'none'} />
                        )}
                        <div className="m3u-entry-content">
                          <div className="m3u-entry-title">{e.title || 'Untitled'}</div>
                          <div className="m3u-entry-url">{e.entry_url}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {selectedEntry && (
                  <div className="m3u-actions">
                    <button className="m3u-select-btn" onClick={handleSelectEntry}>
                      Select Entry
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="m3u-empty">Select a playlist to view entries</p>
            )}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  )
}
