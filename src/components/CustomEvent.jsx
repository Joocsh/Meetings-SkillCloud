import React from 'react';
import format from 'date-fns/format';
import differenceInMinutes from 'date-fns/differenceInMinutes';

export default function CustomEvent({ event }) {
  const durationInMins = differenceInMinutes(event.end, event.start);
  const isShortMeeting = durationInMins < 45;

  if (isShortMeeting) {
    // For fast meetings < 45mins: "10:20am Title"
    const startTimeShort = format(event.start, 'h:mma').toLowerCase();
    return (
      <div className="custom-event-content short-meeting">
        <span className="ev-start-time">
          {startTimeShort}
        </span>
        <span className="ev-title">
          {event.title}
        </span>
      </div>
    );
  }

  // For meetings 45mins or longer: Stacked time and title
  const startTimeFull = format(event.start, 'h:mm a');
  const endTimeFull = format(event.end, 'h:mm a');

  return (
    <div className="custom-event-content long-meeting">
      <span className="ev-time-full">
        <span className="ev-start-time">{startTimeFull}</span>
        <span className="ev-end-time-rest"> – {endTimeFull}</span>
      </span>
      <span className="ev-title">
        {event.title}
      </span>
    </div>
  );
}
