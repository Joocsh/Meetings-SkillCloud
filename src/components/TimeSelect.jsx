import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Clock } from 'lucide-react';

const TIME_OPTIONS = [];
for (let h = 0; h <= 23; h++) {
  const hrStr = h.toString().padStart(2, '0');
  const hr12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h >= 12 ? 'PM' : 'AM';
  ['00', '15', '30', '45'].forEach(min => {
    TIME_OPTIONS.push({ value: `${hrStr}:${min}`, label: `${hr12}:${min} ${ampm}` });
  });
}

export default function TimeSelect({ value, onChange, placeholder = "Select time..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const containerRef = useRef(null);
  const selectedRef = useRef(null);
  const currentTimeRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // When opening, scroll perfectly to the selected element, 
  // or otherwise the nearest upcoming time in the real world
  useEffect(() => {
    if (isOpen && !isManual) {
      if (value && selectedRef.current) {
        selectedRef.current.scrollIntoView({ block: 'center' });
      } else if (currentTimeRef.current) {
        currentTimeRef.current.scrollIntoView({ block: 'center' });
      }
    }
  }, [isOpen, value, isManual]);

  // Format the visual label: either use exactly to the 15-min options, 
  // or parse the manual format nicely for custom times.
  let selectedLabel = placeholder;
  if (value) {
    const found = TIME_OPTIONS.find(opt => opt.value === value);
    if (found) {
      selectedLabel = found.label;
    } else {
      const [h, m] = value.split(':');
      const hr = parseInt(h, 10);
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const hr12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
      selectedLabel = `${hr12}:${m} ${ampm}`;
    }
  }

  // Let's find the closest upcoming 15-min interval just in case there's no value.
  const now = new Date();
  const currentHr = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes();
  const closestMin = min < 15 ? '15' : min < 30 ? '30' : min < 45 ? '45' : '00';
  const closestHr = closestMin === '00' ? ((now.getHours() + 1) % 24).toString().padStart(2, '0') : currentHr;
  const nearestUpcomingValue = `${closestHr}:${closestMin}`;

  if (isManual) {
    return (
      <div className="time-select-container" ref={containerRef}>
        <input
          type="time"
          className="standard-input"
          value={value || ''}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setIsManual(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setIsManual(false);
            }
          }}
          style={{ 
            borderColor: 'var(--sc-blue)', 
            boxShadow: '0 0 0 3px rgba(26,115,232,.12)',
            width: '100%',
            cursor: 'text'
          }}
        />
      </div>
    );
  }

  return (
    <div className="time-select-container" ref={containerRef}>
      <button 
        type="button" 
        className="time-select-button standard-input"
        onClick={() => setIsOpen(!isOpen)}
        onDoubleClick={() => {
          setIsManual(true);
          setIsOpen(false);
        }}
        title="Double-click to set manual time"
        style={{ borderColor: isOpen ? 'var(--sc-blue)' : '', boxShadow: isOpen ? '0 0 0 3px rgba(26,115,232,.12)' : '' }}
      >
        <span className="time-select-value">
          <Clock size={14} color="#6b7280" style={{marginTop: '-1px'}} />
          {selectedLabel}
        </span>
        <ChevronDown size={15} color="#6b7280" />
      </button>

      {isOpen && (
        <div className="time-select-dropdown">
          {TIME_OPTIONS.map(opt => {
            // Find if this is the closest predefined option to highlight
            const isExactMatch = opt.value === value;
            const isNearest = !value && opt.value === nearestUpcomingValue;
            
            return (
              <div 
                key={opt.value}
                ref={isExactMatch ? selectedRef : isNearest ? currentTimeRef : null}
                className={`time-select-item ${isExactMatch ? 'selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
