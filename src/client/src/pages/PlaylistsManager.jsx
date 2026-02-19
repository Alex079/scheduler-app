import { useState, useEffect } from 'react'
import { m3uAPI } from '../api/client'
import './PlaylistsManager.css'

export default function PlaylistsManager() {
  const [playlists, setPlaylists] = useState([])
  const [entries, setEntries] = useState([])
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
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

  return (
    <div className="playlists-manager">
      <div className="playlists-header">
        <h2>M3U Playlists</h2>
        <p className="playlists-description">Manage your M3U playlist URLs and cached entries</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="playlists-content">
        {/* Left: Add Playlist Form + List */}
        <div className="playlists-left">
          <div className="add-playlist-section">
            <h3>Add Playlist</h3>
            <form onSubmit={handleAddPlaylist} className="playlist-add-form">
              <input
                type="url"
                value={newPlaylistUrl}
                onChange={(e) => setNewPlaylistUrl(e.target.value)}
                placeholder="M3U playlist URL"
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
                {addingPlaylist ? 'Adding...' : 'Add Playlist'}
              </button>
            </form>
          </div>

          <div className="playlists-list-section">
            <h3>Your Playlists ({playlists.length})</h3>
            <div className="playlists-list">
              {loading && playlists.length === 0 && <p>Loading...</p>}
              {playlists.length === 0 ? (
                <p className="empty-message">No playlists yet. Add one above!</p>
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
                        {p.last_refreshed 
                          ? `Last refresh: ${new Date(p.last_refreshed).toLocaleString()}`
                          : 'Never refreshed'
                        }
                      </div>
                    </div>
                    <div className="playlist-actions">
                      <button
                        className="refresh-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRefresh(p.id)
                        }}
                        title="Refresh now"
                      >
                        ↻
                      </button>
                      <button
                        className="delete-btn"
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
        <div className="playlists-right">
          <h3>Entries {selectedPlaylist && `(${entries.length})`}</h3>
          {selectedPlaylist ? (
            <div className="entries-list">
              {loading && <p>Loading entries...</p>}
              {entries.length === 0 ? (
                <p className="empty-message">No entries in this playlist</p>
              ) : (
                entries.map(e => (
                  <div key={e.id} className="entry-item">
                    {e.logo && (
                      <img src={e.logo} alt="" className="entry-logo" onError={(img) => img.target.style.display = 'none'} />
                    )}
                    <div className="entry-content">
                      <div className="entry-title">{e.title || 'Untitled'}</div>
                      <div className="entry-url" title={e.entry_url}>{e.entry_url}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p className="empty-message">Select a playlist to view its entries</p>
          )}
        </div>
      </div>
    </div>
  )
}
