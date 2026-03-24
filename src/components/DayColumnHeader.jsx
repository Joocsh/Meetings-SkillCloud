import React from 'react';
import format from 'date-fns/format';
import isToday from 'date-fns/isToday';

export default function DayColumnHeader({ date }) {
  const dayName = format(date, 'EEE');  // "Mon", "Tue", etc.
  const dayNumber = format(date, 'd');   // "1", "17", etc.
  const today = isToday(date);

  return (
    <div className={`savvy-day-header${today ? ' savvy-day-header--today' : ''}`}>
      <span className="savvy-day-header__name">{dayName}</span>
      <span className="savvy-day-header__number">{dayNumber}</span>
    </div>
  );
}
