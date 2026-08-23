import { useState } from 'react'
import Login from './pages/Login'
import Schedule from './pages/Schedule'
import './App.css'

export default function App() {
  const [username, setUsername] = useState(() => localStorage.getItem('username'))
  const [isLoggedIn, setIsLoggedIn] = useState(() => username && localStorage.getItem('token'))

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
