

// Convert Unix timestamp seconds to datetime-local format for user display
export const unixSecondsToLocalTime = (unixSeconds) => {
  if (!unixSeconds) return 'N/A'
  return new Date(unixSeconds * 1000).toLocaleString()
}
