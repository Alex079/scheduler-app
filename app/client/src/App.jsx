import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Schedule from './pages/Schedule'
import './App.css'

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState('')

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('username')
    if (token && user) {
      setUsername(user)
      setIsLoggedIn(true)
    }
  }, [])

  const handleLoginSuccess = (user) => {
    setUsername(user)
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    setIsLoggedIn(false)
    setUsername('')
  }

  return (
    <div>
      {isLoggedIn ? (
        <Schedule username={username} onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  )
}
