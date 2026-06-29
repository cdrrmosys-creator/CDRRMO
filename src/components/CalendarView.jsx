import { useState, useMemo } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'

/**
 * Reusable CalendarView component.
 * @param {Array} events - Array of event objects { id, title, date, color, type, onClick }
 */
export default function CalendarView({ events, currentMonth, onMonthChange }) {
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Ensure currentMonth is always a valid date
  const displayDate = currentMonth || new Date()

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(displayDate))
    const end = endOfWeek(endOfMonth(displayDate))
    return eachDayOfInterval({ start, end })
  }, [displayDate])

  const nextMonth = () => onMonthChange ? onMonthChange(addMonths(displayDate, 1)) : null
  const prevMonth = () => onMonthChange ? onMonthChange(subMonths(displayDate, 1)) : null

  return (
    <div className="calendar-container" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
      {/* Calendar Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--text)' }}>
          {format(displayDate, 'MMMM yyyy')}
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={prevMonth} style={{ padding: '6px 10px', background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer' }}>
            <i className="ri-arrow-left-s-line"></i>
          </button>
          <button onClick={() => onMonthChange && onMonthChange(new Date())} style={{ padding: '6px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
            Today
          </button>
          <button onClick={nextMonth} style={{ padding: '6px 10px', background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer' }}>
            <i className="ri-arrow-right-s-line"></i>
          </button>
        </div>
      </div>

      {/* Days of Week */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, displayDate)
          const isToday = isSameDay(day, new Date())
          
          // Get events for this day
          const dayEvents = events.filter(e => {
            if (!e.date) return false
            const eDate = new Date(e.date)
            return isSameDay(eDate, day)
          })

          return (
            <div 
              key={idx} 
              style={{ 
                minHeight: '100px', 
                padding: '8px',
                background: isCurrentMonth ? '#fff' : '#f8fafc',
                border: '1px solid var(--border-light)',
                borderRadius: '6px',
                opacity: isCurrentMonth ? 1 : 0.6
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                width: '24px', 
                height: '24px', 
                borderRadius: '50%',
                background: isToday ? 'var(--primary)' : 'transparent',
                color: isToday ? '#fff' : 'var(--text)',
                fontWeight: isToday ? '800' : '600',
                fontSize: '12px',
                marginBottom: '8px'
              }}>
                {format(day, 'd')}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {dayEvents.slice(0, 3).map((e, i) => (
                  <div 
                    key={i}
                    onClick={() => e.onClick && e.onClick()}
                    style={{
                      fontSize: '10px',
                      padding: '4px',
                      background: e.color ? `${e.color}15` : 'var(--bg-app)',
                      color: e.color || 'var(--text)',
                      borderLeft: `2px solid ${e.color || 'var(--border-light)'}`,
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                    title={e.title}
                  >
                    {e.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: '700', marginTop: '2px' }}>
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
