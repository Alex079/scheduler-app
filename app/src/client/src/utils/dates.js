// Convert Unix timestamp seconds to datetime-local format for user input field
export const unixSecondsToLocalIsoMinutes = (unixSeconds) => {
  if (!unixSeconds) return ''
  const date = new Date(unixSeconds * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Convert datetime-local format to Unix timestamp seconds for API
export const localIsoMinutesToUnixSeconds = (localString) => {
  if (!localString) return null
  const date = new Date(`${localString}:00`)
  return Math.floor(date.getTime() / 1000)
}

// Convert Unix timestamp seconds to datetime-local format for user display
export const unixSecondsToLocalTime = (unixSeconds) => {
    if (!unixSeconds) return 'N/A'
    return new Date(unixSeconds * 1000).toLocaleString()
}