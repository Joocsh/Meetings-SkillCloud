import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Calendar as CalendarIcon, Clock, ArrowRight, UserCircle2, ArrowLeft } from 'lucide-react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './home.css';
import './dashboard.css';
import { supabase, supabaseAdmin } from '../lib/supabase';
import MiniCalendar from '../components/MiniCalendar';
import CalendarToolbar from '../components/CalendarToolbar';
import DayColumnHeader from '../components/DayColumnHeader';
import CustomEvent from '../components/CustomEvent';

const locales = {
  'en-US': enUS,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [associates, setAssociates] = useState([]);
  const [selectedAssociate, setSelectedAssociate] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calendar view state (for the dashboard-style calendar)
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('week');
  const channelRef = useRef(null);

  // Show full day (7 AM to 11 PM) — matches dashboard
  const calMin = useMemo(() => {
    const d = new Date();
    d.setHours(7, 0, 0, 0);
    return d;
  }, []);
  const calMax = useMemo(() => {
    const d = new Date();
    d.setHours(23, 0, 0, 0);
    return d;
  }, []);

  // Scroll to current hour
  const scrollToTime = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d;
  }, []);

  // Fetch all associates on load
  // Use admin client to bypass RLS (Home page has no auth session)
  const dbClient = supabaseAdmin || supabase;

  useEffect(() => {
    const fetchAssociates = async () => {
      setLoading(true);
      const { data, error } = await dbClient
        .from('users')
        .select('*')
        .order('full_name');
      
      if (!error) {
        setAssociates(data || []);
      }
      setLoading(false);
    };
    fetchAssociates();
  }, []);

  // Recurring event expansion (same logic as dashboards)
  const expandRecurringEvents = (rawData) => {
    const list = [];
    rawData.forEach(ev => {
      const rootStart = new Date(ev.start_time);
      const rootEnd = new Date(ev.end_time);
      list.push({ ...ev, start: rootStart, end: rootEnd });

      if (ev.recurrence_rule && ev.recurrence_rule !== 'none') {
        for (let i = 1; i <= 60; i++) {
          let newStart = new Date(rootStart);
          let newEnd = new Date(rootEnd);

          if (ev.recurrence_rule === 'daily') {
            newStart.setDate(rootStart.getDate() + i);
            newEnd.setDate(rootEnd.getDate() + i);
          } else if (ev.recurrence_rule === 'weekly') {
            newStart.setDate(rootStart.getDate() + (i * 7));
            newEnd.setDate(rootEnd.getDate() + (i * 7));
          } else if (ev.recurrence_rule === 'monthly') {
            newStart.setMonth(rootStart.getMonth() + i);
            newEnd.setMonth(rootEnd.getMonth() + i);
          }

          list.push({
            ...ev,
            id: `${ev.id}-instance-${i}`,
            isRecurringInstance: true,
            originalId: ev.id,
            start: newStart,
            end: newEnd
          });
        }
      }
    });
    return list;
  };

  const fetchAssociateSchedule = async (id) => {
    const { data, error } = await dbClient
      .from('meetings')
      .select('*')
      .or(`organizer_id.eq.${id},participant_id.eq.${id}`);
    
    if (!error) {
      setSelectedEvents(expandRecurringEvents(data || []));
    }
  };

  // Real-time subscription for the selected associate's meetings
  useEffect(() => {
    if (!selectedAssociate) {
      // Cleanup channel when going back
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase.channel('home_meetings_sync', {
      config: { broadcast: { ack: false } }
    });

    channel.on('broadcast', { event: 'refresh_meetings' }, async () => {
      // Re-fetch selected associate's meetings on any change
      await fetchAssociateSchedule(selectedAssociate.id);
    }).subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [selectedAssociate]);

  const filtered = associates.filter((asc) =>
    (asc.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (asc.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (asc.role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (asc.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusStyle = (status) => {
    switch (status) {
      case 'available': return { bg: '#e6f4ea', text: '#38a169', dot: '#48bb78' }; 
      case 'busy': return { bg: '#fde8e8', text: '#e53e3e', dot: '#f56565' };      
      case 'in-meeting': return { bg: '#feebc8', text: '#dd6b20', dot: '#ed8936' }; 
      case 'away': return { bg: '#e2e8f0', text: '#718096', dot: '#a0aec0' };       
      default: return { bg: '#e2e8f0', text: '#718096', dot: '#a0aec0' };
    }
  };

  const handleSelectAssociate = async (asc) => {
    setSelectedAssociate(asc);
    setSearchTerm('');
    setCalendarDate(new Date());
    setCalendarView('week');
    await fetchAssociateSchedule(asc.id);
    // Scroll to the top so the calendar is visible
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Event styles — same as dashboard
  const eventStyleGetter = (event) => {
    return {
      style: {
        backgroundColor: '#122345',
        borderRadius: '6px',
        opacity: 0.98,
        color: '#ffffff',
        border: '1px solid rgba(0,0,0,0.1)',
        borderLeft: '4px solid #10b981',
        display: 'block',
        fontSize: '12.5px',
        fontWeight: 500,
        padding: '6px 10px',
        boxShadow: '0 2px 5px rgba(18, 35, 69, 0.12)',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        fontFamily: 'var(--sc-font)',
        letterSpacing: '0.2px',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease',
      }
    };
  };

  // Upcoming meetings for sidebar
  const upcomingEvents = selectedEvents
    .filter(ev => ev.start > new Date())
    .sort((a, b) => a.start - b.start)
    .slice(0, 5);

  // Helper
  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : '??';

  const renderContent = () => {
    if (loading) {
      return (
        <section className="empty-search-state">
          <div className="state-content">
            <p>Loading colleagues from directory...</p>
          </div>
        </section>
      );
    }

    if (selectedAssociate) {
      // Full Dashboard-Style Calendar View
      return (
        <section className="home-calendar-dashboard">
          {/* Top bar with back button and associate info */}
          <div className="home-cal-topbar">
            <button className="back-btn" onClick={() => setSelectedAssociate(null)}>
              <ArrowLeft size={18} />
              <span>Back to search</span>
            </button>
            <div className="home-cal-profile">
              <div className="nav-avatar" style={{ width: '36px', height: '36px', fontSize: '13px' }}>
                {selectedAssociate.avatar || getInitials(selectedAssociate.full_name || selectedAssociate.username)}
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--sc-text-1)', lineHeight: 1.2 }}>
                  {selectedAssociate.full_name || selectedAssociate.username}'s Calendar
                </p>
                <p style={{ fontSize: '12px', color: 'var(--sc-text-3)', marginTop: '2px' }}>
                  {selectedAssociate.role === 'admin' ? 'Administrator' : 'Corporate Associate'} · Live view
                </p>
              </div>
            </div>
          </div>

          {/* Dashboard layout: Sidebar + Main calendar */}
          <div className="dash-content savvy-layout home-savvy-layout">
            {/* Left Sidebar */}
            <aside className="savvy-sidebar">
              <MiniCalendar
                selectedDate={calendarDate}
                onDateSelect={(date) => setCalendarDate(date)}
              />

              {/* Upcoming meetings in sidebar */}
              <div className="savvy-sidebar-section">
                <h4 className="savvy-sidebar-title">Upcoming Meetings</h4>
                {upcomingEvents.length === 0 ? (
                  <p className="savvy-sidebar-empty">No upcoming meetings</p>
                ) : (
                  <div className="savvy-sidebar-meetings">
                    {upcomingEvents.slice(0, 4).map(ev => (
                      <div key={ev.id} className="savvy-sidebar-meeting">
                        <div className="savvy-sidebar-meeting-time">
                          {ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="savvy-sidebar-meeting-info">
                          <span className="savvy-sidebar-meeting-title">{ev.title}</span>
                          <span className="savvy-sidebar-meeting-date">
                            {ev.start.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            {/* Main Calendar Area */}
            <section className="savvy-main">
              <div className="calendar-wrapper">
                <Calendar
                  localizer={localizer}
                  events={selectedEvents}
                  startAccessor="start"
                  endAccessor="end"
                  view={calendarView}
                  views={['day', 'week', 'month']}
                  step={30}
                  timeslots={2}
                  date={calendarDate}
                  min={calMin}
                  max={calMax}
                  getNow={() => new Date()}
                  onNavigate={(newDate) => setCalendarDate(newDate)}
                  onView={(v) => setCalendarView(v)}
                  scrollToTime={scrollToTime}
                  eventPropGetter={eventStyleGetter}
                  components={{ 
                    toolbar: CalendarToolbar, 
                    week: { header: DayColumnHeader },
                    day: { header: DayColumnHeader },
                    event: CustomEvent 
                  }}
                />
              </div>
            </section>
          </div>
        </section>
      );
    }

    // Directory / Search Results State
    return (
      <section className="results-section">
        <div className="results-header">
          {searchTerm ? (
            <p className="results-count">
              Found {filtered.length} result{filtered.length !== 1 && 's'} for "{searchTerm}"
            </p>
          ) : (
            <p className="results-count">Showing all associates in directory</p>
          )}
        </div>

        <div className="cards-grid">
          {filtered.length > 0 ? (
            filtered.map((asc) => {
              const statusStyle = getStatusStyle(asc.status || 'available');
              const displayName = asc.full_name || asc.username || 'Anonymous User';
              
              return (
                <div key={asc.id} className="associate-card" onClick={() => handleSelectAssociate(asc)}>
                  <div className="card-header">
                    <div className="associate-info">
                      <div className="avatar">
                         <div style={{ padding: '8px', background: '#f0f4f8', color: '#122345', borderRadius: '50%', fontWeight: '600', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {asc.avatar || getInitials(displayName)}
                         </div>
                      </div>
                      <div>
                        <h3>{displayName}</h3>
                        <p>{asc.role} · {asc.department || 'Associate'}</p>
                      </div>
                    </div>
                    <div className="status-badge" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                      <span className="status-dot" style={{ backgroundColor: statusStyle.dot }}></span>
                      {(asc.status || 'available').charAt(0).toUpperCase() + (asc.status || 'available').slice(1)}
                    </div>
                  </div>
                  
                  <div className="card-body">
                    <div className="meeting-info">
                      <Clock size={16} color="#6b7a99" />
                      <span><strong>Schedule:</strong> View availability below</span>
                    </div>
                    <button className="view-calendar-btn">
                      <CalendarIcon size={16} />
                      Click to View Full Calendar
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="no-results">
              <p>No associates found. Try a different search term.</p>
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="home-wrapper">
      <div className="hero-wrapper" style={{ paddingBottom: selectedAssociate ? '20px' : '80px' }}>
        <nav className="navbar">
          <div className="nav-container">
            <div className="logo home-logo" onClick={() => setSelectedAssociate(null)} style={{ cursor: 'pointer' }}>
              <img
                src="/logo.png"
                alt="SkillCloud Staffing"
                style={{ height: '52px', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
              />
            </div>
            
            <Link to="/login" className="nav-signin-btn">
              Sign In
              <ArrowRight size={16} />
            </Link>
          </div>
        </nav>

        {!selectedAssociate && (
          <section className="hero-section">
            <div className="hero-content">
              <h1>Find your colleague's <span className="highlight-text">availability</span> real-time</h1>
              <p className="hero-subtext">Search by name or role to view their live schedule and upcoming meetings.</p>
            </div>
          </section>
        )}
      </div>

      <main className="home-main">
        {!selectedAssociate && (
          <div className="search-overlap-container">
            <div className="search-bar-wrapper">
              <Search className="search-icon" size={24} />
              <input 
                type="text" 
                placeholder="Search associates (e.g., Joshua Rodriguez, Admin)..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
                autoFocus
              />
            </div>
          </div>
        )}

        {renderContent()}
      </main>
      
      <footer className="home-footer">
        <p>© {new Date().getFullYear()} SkillCloud Staffing · Executive Platform</p>
      </footer>
    </div>
  );
}
