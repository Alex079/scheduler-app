import { unixSecondsToLocalTime } from "../utils/dates";

export default function EventList({ events, isLoading, onEdit, onDelete }) {
  if (isLoading) return <p>⏳</p>

  if (events.length === 0) return <p className="schedule-no-events">No events scheduled yet</p>

  return (
    <div className="schedule-events-list">
      {events.map(event => (
        <EventCard key={event.id} event={event} onEdit={() => onEdit(event)} onDelete={() => onDelete(event.id)} />
      ))}
    </div>
  )
}

function EventCard({ event, onEdit, onDelete }) {
  const now = Date.now() / 1000;
  const futureEvent = now < event.start_time;
  const pastEvent = event.end_time < now;
  const currentEvent = !futureEvent && !pastEvent;
  const isEditable = futureEvent;
  const isDeletable = !currentEvent;

  const editButtonTitle = () => {
    if (pastEvent) {
      return 'Cannot edit: event has ended'
    }
    if (currentEvent) {
      return `Cannot edit: event is ongoing`
    }
    return 'Edit'
  }

  const deleteButtonTitle = () => {
    if (currentEvent) {
      return `Cannot delete: event is ongoing`
    }
    return 'Delete'
  }

  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  const secondsToDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  return (
    <div className="schedule-event-card">
      <div className="schedule-event-info">
        <div className="event-header-row">
          <h3>{event.name}</h3>
          {event.recording_status && (
            <p title={capitalize(event.recording_status)} className={`recording-status recording-status-${event.recording_status}`}>{secondsToDuration(event.end_time - event.start_time)}</p>
          )}
        </div>
        <div className="event-properties-row">
          <p className="schedule-event-property"><span className="time-label">Start:</span>{unixSecondsToLocalTime(event.start_time)}</p>
          <p className="schedule-event-property"><span className="time-label">End:</span>{unixSecondsToLocalTime(event.end_time)}</p>
          <p className="schedule-event-property">
            <span className="time-label">Stream:</span>
            <a href={event.entry_url} target="_blank" rel="noopener noreferrer" title={event.entry_url}>{event.entry_title || 'View'}</a>
          </p>
        </div>
        {event.recording_file && (
          <p className="schedule-event-filename"><span className="time-label">File:</span><span title={event.recording_file}>{event.recording_file}</span></p>
        )}
      </div>
      <div className="schedule-event-actions">
        <button className="schedule-edit-btn" onClick={onEdit} disabled={!isEditable} title={editButtonTitle()}>Edit</button>
        <button className="schedule-delete-btn" onClick={onDelete} disabled={!isDeletable} title={deleteButtonTitle()}>Delete</button>
      </div>
    </div>
  )
}
