import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Calendar as CalendarIcon, Search, X, LogOut, UserCircle2, MessageSquare } from 'lucide-react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './dashboard.css';
import { supabase } from '../lib/supabase';
import MiniCalendar from '../components/MiniCalendar';
import CalendarToolbar from '../components/CalendarToolbar';
import DayColumnHeader from '../components/DayColumnHeader';
import CustomEvent from '../components/CustomEvent';
import TimeSelect from '../components/TimeSelect';
import { useUpcomingMeetingAlerts, notificationPermissionGranted } from '../hooks/useUpcomingMeetingAlerts';
import NotificationPermissionBar from '../components/NotificationPermissionBar';

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


export default function AssociateDashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [otherAssociates, setOtherAssociates] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Navbar UI State
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);
  const channelRef = useRef(null);

  // Meeting Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [modalSearch, setModalSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedModalAssociate, setSelectedModalAssociate] = useState(null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingStartTime, setMeetingStartTime] = useState('');
  const [meetingEndTime, setMeetingEndTime] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [recurrenceRule, setRecurrenceRule] = useState('none');
  
  // Calendar View State
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('week');

  // Show full day (7 AM to 11 PM) for a SavvyCal-like experience
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

  // MANDATORY meeting alerts (fires 10 min before each meeting inside the app)
  const { activeVisualAlert, dismissAlert } = useUpcomingMeetingAlerts(events, 10);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      setCurrentUser({ ...session.user, ...profile });

      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .neq('id', session.user.id);
      setOtherAssociates(usersData || []);

      const { data: meetingsData } = await supabase
        .from('meetings')
        .select('*')
        .or(`organizer_id.eq.${session.user.id},participant_id.eq.${session.user.id}`);
      
      setEvents(expandRecurringEvents(meetingsData || []));
      setLoading(false);

      // ── Realtime: auto-refresh when ANY meeting changes via Broadcast ──
      const channel = supabase.channel('meetings_sync', {
        config: { broadcast: { ack: false } }
      });

      channel.on('broadcast', { event: 'refresh_meetings' }, async () => {
        // Re-fetch only this user's meetings
        const { data: refreshed } = await supabase
          .from('meetings')
          .select('*')
          .or(`organizer_id.eq.${session.user.id},participant_id.eq.${session.user.id}`);
        setEvents(expandRecurringEvents(refreshed || []));
      }).subscribe();

      // Store cleanup ref
      channelRef.current = channel;
    };

    fetchData();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [navigate]);

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

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Upcoming meetings notifications (next 7 days)
  const upcomingNotifications = events
    .filter(ev => ev.start > new Date())
    .sort((a, b) => a.start - b.start)
    .slice(0, 5);

  const handleSelectSlot = (slotInfo) => {
    setSelectedSlot(slotInfo);
    setSelectedDate(slotInfo.start);
    
    // Extract HH:mm for the time inputs
    const pad = (num) => num.toString().padStart(2, '0');
    const startStr = `${pad(slotInfo.start.getHours())}:${pad(slotInfo.start.getMinutes())}`;
    const endStr = `${pad(slotInfo.end.getHours())}:${pad(slotInfo.end.getMinutes())}`;

    setMeetingStartTime(startStr);
    setMeetingEndTime(endStr);
    setMeetingTitle('');
    setMeetingNotes('');
    setMeetingLink('');
    setSelectedModalAssociate(null);
    setModalSearch('');
    setEditingEventId(null);
    setRecurrenceRule('none');
    setIsModalOpen(true);
  };

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!selectedModalAssociate || !meetingStartTime || !meetingEndTime || !selectedDate || !currentUser) return;

    // Construct the actual Date objects
    const [startH, startM] = meetingStartTime.split(':').map(Number);
    const [endH, endM] = meetingEndTime.split(':').map(Number);

    const newStart = new Date(selectedDate);
    newStart.setHours(startH, startM, 0, 0);

    const newEnd = new Date(selectedDate);
    newEnd.setHours(endH, endM, 0, 0);

    const meetingData = {
      title: meetingTitle || `Meeting with ${selectedModalAssociate.full_name || selectedModalAssociate.username}`,
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
      organizer_id: currentUser.id,
      participant_id: selectedModalAssociate.id,
      recurrence_rule: recurrenceRule,
      notes: meetingNotes,
      link: meetingLink
    };

    if (editingEventId) {
      const { error } = await supabase
        .from('meetings')
        .update(meetingData)
        .eq('id', editingEventId);
      
      if (error) {
        alert('Error updating meeting: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('meetings')
        .insert([meetingData]);
      
      if (error) {
        alert('Error creating meeting: ' + error.message);
        return;
      }
    }

    // Refresh events from DB (as organizer OR participant) with expansion logic
    const { data: meetingsData } = await supabase
      .from('meetings')
      .select('*')
      .or(`organizer_id.eq.${currentUser.id},participant_id.eq.${currentUser.id}`);

    setEvents(expandRecurringEvents(meetingsData || []));

    // Send broadcast to update other open browsers
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'refresh_meetings',
        payload: {},
      });
    }

    setIsModalOpen(false);
  };

  const handleSelectEvent = (event) => {
    setSelectedSlot(null);
    setSelectedDate(event.start);
    setEditingEventId(event.id);

    const pad = (num) => num.toString().padStart(2, '0');
    setMeetingStartTime(`${pad(event.start.getHours())}:${pad(event.start.getMinutes())}`);
    setMeetingEndTime(`${pad(event.end.getHours())}:${pad(event.end.getMinutes())}`);
    
    // In Associate view, we look for a participant, but for now we look for the organizer or other colleagues
    const colleague = otherAssociates.find(a => a.id === event.participant_id); 
    if (colleague) {
        setSelectedModalAssociate(colleague);
        setModalSearch(colleague.full_name || colleague.username);
    } else {
        setSelectedModalAssociate(null);
        setModalSearch('');
    }

    setMeetingTitle(event.title || '');
    setRecurrenceRule(event.recurrence_rule || 'none');
    setMeetingNotes(event.notes || '');
    setMeetingLink(event.link || '');

    setIsModalOpen(true);
  };

  const handleDeleteMeeting = async () => {
    if (editingEventId) {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', editingEventId);
      
      if (error) {
        alert('Error deleting meeting: ' + error.message);
        return;
      }

      setEvents(events.filter(e => e.id !== editingEventId));

      // Send broadcast to update other open browsers
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'refresh_meetings',
          payload: {},
        });
      }

      setIsModalOpen(false);
    }
  };

  const filteredModalAssociates = otherAssociates.filter(a => 
    (a.full_name || '').toLowerCase().includes(modalSearch.toLowerCase()) ||
    (a.username || '').toLowerCase().includes(modalSearch.toLowerCase())
  );

  const eventStyleGetter = (event) => {
    return {
      style: {
        backgroundColor: '#122345',
        borderRadius: '6px',
        opacity: 0.98,
        color: '#ffffff',
        border: '1px solid rgba(0,0,0,0.1)',
        borderLeft: '4px solid #10b981', // Emerald green accent for associate events
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

  if (loading) return <div className="loading-screen">Loading Schedule...</div>;

  return (
    <div className="dashboard-wrapper">
      <NotificationPermissionBar />
      {/* Navbar Section */}
      <nav className="dash-navbar">
        <div className="dash-nav-left">
          <Link to="/" className="dash-logo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <img
              src="/logo_color.png"
              alt="SkillCloud Staffing"
              style={{ height: '52px', width: 'auto', objectFit: 'contain' }}
            />
          </Link>
        </div>

        <div className="dash-nav-right">
          {/* Notifications Bell */}
          <div className="nav-notifications" ref={notifRef} title="Notifications" onClick={() => setShowNotifications(v => !v)}>
            <Bell size={20} />
            {upcomingNotifications.length > 0 && (
              <span className="notification-badge">{upcomingNotifications.length}</span>
            )}
            {showNotifications && (
              <div className="notifications-dropdown">
                <div className="notif-dropdown-header">
                  <h4>Upcoming Meetings</h4>
                  <span className="notif-count-pill">{upcomingNotifications.length}</span>
                </div>
                {upcomingNotifications.length === 0 ? (
                  <div className="notif-empty">
                    <CalendarIcon size={28} strokeWidth={1.5} />
                    <p>No upcoming meetings</p>
                  </div>
                ) : (
                  <div className="notif-list">
                    {upcomingNotifications.map(ev => (
                      <div key={ev.id} className="notif-item" onClick={() => handleSelectEvent(ev)}>
                        <div className="notif-icon">
                          <CalendarIcon size={16} />
                        </div>
                        <div className="notif-content">
                          <h4>{ev.title}</h4>
                          <p>
                            {ev.start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                            {' · '}
                            {ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="nav-profile" ref={userMenuRef} onClick={() => setShowUserMenu(v => !v)}>
            <div className="nav-profile-info">
              <p className="nav-profile-name">{currentUser?.full_name || 'Associate'}</p>
              <p className="nav-profile-role">Corporate Associate</p>
            </div>
            <div className="nav-avatar">
              {currentUser?.avatar || 'A'}
            </div>
            {showUserMenu && (
              <div className="user-menu-dropdown">
                <button className="user-menu-item user-menu-logout" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
                  <LogOut size={16} />
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="dash-content savvy-layout">
        {/* Left Sidebar */}
        <aside className="savvy-sidebar">
          <MiniCalendar
            selectedDate={calendarDate}
            onDateSelect={(date) => setCalendarDate(date)}
          />

          {/* Upcoming meetings in sidebar */}
          <div className="savvy-sidebar-section">
            <h4 className="savvy-sidebar-title">Upcoming Meetings</h4>
            {upcomingNotifications.length === 0 ? (
              <p className="savvy-sidebar-empty">No upcoming meetings</p>
            ) : (
              <div className="savvy-sidebar-meetings">
                {upcomingNotifications.slice(0, 4).map(ev => (
                  <div key={ev.id} className="savvy-sidebar-meeting" onClick={() => handleSelectEvent(ev)}>
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
              events={events}
              startAccessor="start"
              endAccessor="end"
              view={calendarView}
              views={['day', 'week', 'month']}
              step={30}
              timeslots={2}
              selectable={true}
              date={calendarDate}
              min={calMin}
              max={calMax}
              getNow={() => new Date()}
              onNavigate={(newDate) => setCalendarDate(newDate)}
              onView={(v) => setCalendarView(v)}
              scrollToTime={scrollToTime}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
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
      </main>

      {/* SCHEDULE MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingEventId ? 'Edit Meeting' : 'Schedule Meeting'}</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateMeeting} className="modal-form">
              <div className="form-group">
                <label>Find Associate/Admin</label>
                <div className="search-bar">
                  <Search size={16} color="#6b7a99" />
                  <input 
                    type="text" 
                    placeholder="Search name..." 
                    value={modalSearch}
                    onChange={(e) => {
                      setModalSearch(e.target.value);
                      setSelectedModalAssociate(null);
                    }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                  />
                </div>
                {searchFocused && !selectedModalAssociate && (
                  <div className="modal-dropdown">
                    {filteredModalAssociates.map(a => (
                      <div 
                        key={a.id} 
                        className="dropdown-item"
                        onClick={() => {
                          const name = a.full_name || a.username;
                          setSelectedModalAssociate(a);
                          setModalSearch(name);
                          setSearchFocused(false);
                        }}
                      >
                        {a.full_name || a.username} - {a.role === 'admin' ? 'Administration' : 'Associate'}
                      </div>
                    ))}
                    {filteredModalAssociates.length === 0 && (
                      <div className="dropdown-item empty">No colleagues found</div>
                    )}
                  </div>
                )}
              </div>

              {selectedModalAssociate && (
                <div className="form-group">
                  <label>Meeting Title (Optional)</label>
                  <input 
                    type="text" 
                    placeholder={`Meeting with ${selectedModalAssociate.full_name || selectedModalAssociate.username}`}
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    className="standard-input"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Date</label>
                <div className="standard-input" style={{ background: '#f4f6fb', color: '#6b7a99' }}>
                  {selectedDate ? selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                </div>
              </div>

              <div className="form-group">
                <label>Repeat / Recurrence</label>
                <select 
                  className="standard-input"
                  value={recurrenceRule}
                  onChange={(e) => setRecurrenceRule(e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Every Day</option>
                  <option value="weekly">Every Week (same weekday)</option>
                  <option value="monthly">Every Month (same date)</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <TimeSelect
                    value={meetingStartTime}
                    onChange={(val) => setMeetingStartTime(val)}
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <TimeSelect
                    value={meetingEndTime}
                    onChange={(val) => setMeetingEndTime(val)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Meeting Link (Optional)</label>
                <input 
                  type="url" 
                  placeholder="https://zoom.us/j/..."
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  className="standard-input"
                />
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea 
                  placeholder="Goals for this meeting..."
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  className="standard-input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: editingEventId ? 'space-between' : 'flex-end', width: '100%' }}>
                {editingEventId && (
                  <button type="button" className="cancel-btn" style={{ color: '#e53e3e', borderColor: '#fc8181', marginRight: 'auto' }} onClick={handleDeleteMeeting}>
                    Delete Record
                  </button>
                )}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="save-btn" disabled={!selectedModalAssociate || !meetingStartTime || !meetingEndTime}>
                    {editingEventId ? 'Save Changes' : 'Schedule Meeting'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* NOTIFICATION CARD (TOP RIGHT) */}
      {activeVisualAlert && (
        <div className="toast-notification">
          <div className="toast-icon">
            <Bell size={18} color="#1a73e8" />
          </div>
          <div className="toast-content">
            <h4>Meeting Starting Soon</h4>
            <p>"{activeVisualAlert.title}"</p>
            <span className="toast-time">
              {activeVisualAlert.minutesLeft === 0 ? 'Starts NOW' : `Starts in ${activeVisualAlert.minutesLeft} min`}
            </span>
          </div>
          <button className="toast-close" onClick={dismissAlert}>
            <X size={16} />
          </button>
        </div>
      )}

    </div>
  );
}
