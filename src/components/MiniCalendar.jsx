import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Returns 0=Mon, 1=Tue, ... 6=Sun (ISO weekday)
function getFirstDayOfMonthISO(year, month) {
  const jsDay = new Date(year, month, 1).getDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1;
}

export default function MiniCalendar({ selectedDate, onDateSelect }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  useEffect(() => {
    setViewYear(selectedDate.getFullYear());
    setViewMonth(selectedDate.getMonth());
  }, [selectedDate]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDayClick = (day) => {
    const newDate = new Date(viewYear, viewMonth, day);
    onDateSelect(newDate);
  };

  const firstDay = getFirstDayOfMonthISO(viewYear, viewMonth);
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const prevMonthIdx = viewMonth - 1 < 0 ? 11 : viewMonth - 1;
  const daysInPrev = getDaysInMonth(viewYear, prevMonthIdx);

  // Build grid
  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: daysInPrev - firstDay + 1 + i, type: 'prev' });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, type: 'current' });
  }
  while (cells.length < 42) {
    cells.push({ day: cells.length - firstDay - daysInMonth + 1, type: 'next' });
  }

  const isToday = (day, type) =>
    type === 'current' &&
    day === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear();

  const isSelected = (day, type) =>
    type === 'current' &&
    day === selectedDate.getDate() &&
    viewMonth === selectedDate.getMonth() &&
    viewYear === selectedDate.getFullYear();

  // Check if a day is in the selected week range
  const isInSelectedWeek = (day, type) => {
    if (type !== 'current') return false;
    const d = new Date(viewYear, viewMonth, day);
    // Get Monday of selectedDate's week
    const selDay = selectedDate.getDay();
    const mondayOffset = selDay === 0 ? -6 : 1 - selDay;
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return d >= weekStart && d <= weekEnd;
  };

  return (
    <div className="sidebar-mini-cal">
      {/* Header */}
      <div className="sidebar-mini-cal-header">
        <span className="sidebar-mini-cal-title">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <div className="sidebar-mini-cal-nav">
          <button className="sidebar-mini-cal-arrow" onClick={prevMonth} title="Previous month">
            <ChevronLeft size={14} />
          </button>
          <button className="sidebar-mini-cal-arrow" onClick={nextMonth} title="Next month">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="sidebar-mini-cal-grid">
        {DAY_LABELS.map((label, i) => (
          <div key={i} className="sidebar-mini-cal-label">{label}</div>
        ))}

        {/* Day cells */}
        {cells.map((cell, i) => {
          const today_ = isToday(cell.day, cell.type);
          const selected_ = isSelected(cell.day, cell.type);
          const inWeek_ = isInSelectedWeek(cell.day, cell.type);
          
          return (
            <button
              key={i}
              className={[
                'sidebar-mini-cal-day',
                cell.type !== 'current' ? 'sidebar-mini-cal-day--faded' : '',
                today_ && !selected_ ? 'sidebar-mini-cal-day--today' : '',
                selected_ ? 'sidebar-mini-cal-day--selected' : '',
                inWeek_ && !selected_ && !today_ ? 'sidebar-mini-cal-day--in-week' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => cell.type === 'current' && handleDayClick(cell.day)}
              disabled={cell.type !== 'current'}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
