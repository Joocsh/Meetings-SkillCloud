import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import format from 'date-fns/format';

const VIEW_LABELS = {
  day:   'Day',
  week:  'Week',
  month: 'Month',
};

export default function CalendarToolbar({ date, view, onNavigate, onView }) {
  const label = format(date, 'MMMM yyyy');

  return (
    <div className="savvy-toolbar">
      {/* Left: Month Year label */}
      <span className="savvy-toolbar-label">{label}</span>

      {/* Right controls */}
      <div className="savvy-toolbar-right">
        {/* Today button */}
        <button
          className="savvy-today-btn"
          onClick={() => onNavigate('TODAY')}
        >
          Today
        </button>

        {/* Navigation arrows */}
        <div className="savvy-toolbar-nav">
          <button
            className="savvy-nav-arrow"
            onClick={() => onNavigate('PREV')}
            title="Previous"
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="savvy-nav-arrow"
            onClick={() => onNavigate('NEXT')}
            title="Next"
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* View switcher (hidden, but functional) */}
        <div className="savvy-toolbar-views">
          {Object.entries(VIEW_LABELS).map(([key, text]) => (
            <button
              key={key}
              className={`savvy-view-btn${view === key ? ' savvy-view-btn--active' : ''}`}
              onClick={() => onView(key)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
