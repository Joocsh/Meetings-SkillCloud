import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, UserCircle2, Calendar as CalendarIcon, Search, X, Settings, LogOut, Plus, Trash2, Edit2, Eye, EyeOff } from 'lucide-react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './dashboard.css';
import { supabase, supabaseAdmin } from '../lib/supabase';
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



// Helper — generate 2-letter initials from a full name
const getInitials = (name) =>
  name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [associates, setAssociates] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Navbar UI State
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);
  const channelRef = useRef(null);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState('list'); // 'list' | 'create' | 'edit'
  const [editingAssociate, setEditingAssociate] = useState(null);
  const [assocForm, setAssocForm] = useState({ name: '', role: '', username: '', password: '' });
  const [showAssocPassword, setShowAssocPassword] = useState(false);
  const [settingsSearch, setSettingsSearch] = useState('');

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // 1. Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      // 2. Get user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      setCurrentUser({ ...session.user, ...profile });

      // 3. Get all associates/users
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('full_name');
      setAssociates(usersData || []);

      // 4. Get all meetings
      const { data: meetingsData } = await supabase
        .from('meetings')
        .select('*');
      
      setEvents(expandRecurringEvents(meetingsData || []));
      setLoading(false);
    };

    fetchData();

    // ── Realtime: auto-refresh when ANY meeting changes via Broadcast ──
    const channel = supabase.channel('meetings_sync', {
      config: { broadcast: { ack: false } }
    });
    
    channel.on('broadcast', { event: 'refresh_meetings' }, async () => {
      // Re-fetch all meetings on any change across browsers
      const { data: meetingsData } = await supabase
        .from('meetings')
        .select('*');
      setEvents(expandRecurringEvents(meetingsData || []));
    }).subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [navigate]);

  // Helper to "Repeat" meetings on the calendar without cluttering the DB
  const expandRecurringEvents = (rawData) => {
    const list = [];
    rawData.forEach(ev => {
      const rootStart = new Date(ev.start_time);
      const rootEnd = new Date(ev.end_time);
      
      // Always push the original event
      list.push({ ...ev, start: rootStart, end: rootEnd });

      if (ev.recurrence_rule && ev.recurrence_rule !== 'none') {
        // Generate future instances (limit to 60 per meeting for performance)
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
            id: `${ev.id}-instance-${i}`, // virtual ID
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
  const [recurrenceRule, setRecurrenceRule] = useState('none'); // 'none', 'daily', 'weekly', 'monthly'
  
  // Calendar View State
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('week');
  
  // Show full day (7 AM to 11 PM) for a SavvyCal-like experience
  const calMin = React.useMemo(() => {
    const d = new Date();
    d.setHours(7, 0, 0, 0);
    return d;
  }, []);
  const calMax = React.useMemo(() => {
    const d = new Date();
    d.setHours(23, 0, 0, 0);
    return d;
  }, []);

  // Scroll to current hour
  const scrollToTime = React.useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d;
  }, []);

  // MANDATORY meeting alerts (fires 10 min before each meeting inside the app)
  const { activeVisualAlert, dismissAlert } = useUpcomingMeetingAlerts(events, 10);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Upcoming meetings notifications
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
      recurrence_rule: recurrenceRule, // 'none', 'daily', 'weekly', 'monthly'
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

    // Refresh events from DB with expansion logic
    const { data: meetingsData } = await supabase.from('meetings').select('*');
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
    
    // Use participant_id to correctly identify the PARTICIPANT (not the organizer)
    const associate = associates.find(a => a.id === event.participant_id);
    if (associate) {
      setSelectedModalAssociate(associate);
      const name = associate.full_name || associate.username;
      setModalSearch(name);
      const defaultTitle = `Meeting with ${name}`;
      setMeetingTitle(event.title === defaultTitle ? '' : (event.title || ''));
    } else {
      setSelectedModalAssociate(null);
      setModalSearch('');
      setMeetingTitle(event.title || '');
    }

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

  const filteredModalAssociates = associates.filter(a => 
    (a.full_name || '').toLowerCase().includes(modalSearch.toLowerCase()) ||
    (a.username || '').toLowerCase().includes(modalSearch.toLowerCase())
  );



  const eventStyleGetter = (event) => {
    return {
      style: {
        backgroundColor: '#122345', // Deep navy dark blue
        borderRadius: '6px',
        opacity: 0.98,
        color: '#ffffff', // Crisp white text
        border: '1px solid rgba(0,0,0,0.1)',
        borderLeft: '4px solid #3b82f6', // Bright blue accent stripe
        display: 'block',
        fontSize: '12.5px',
        fontWeight: 500,
        padding: '6px 10px',
        boxShadow: '0 2px 5px rgba(18, 35, 69, 0.12)',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        fontFamily: 'var(--gc-font)',
        letterSpacing: '0.2px',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease',
      }
    };
  };

  // Settings handlers
  const openCreateAssociate = () => {
    setAssocForm({ name: '', role: 'user', username: '', password: '' });
    setEditingAssociate(null);
    setSettingsView('create');
  };

  const openEditAssociate = (assoc) => {
    setAssocForm({ 
      name: assoc.full_name || '', 
      role: assoc.role || 'user', 
      username: assoc.username || '', 
      password: '' // leave blank — only fill to change password
    });
    setEditingAssociate(assoc);
    setSettingsView('edit');
  };

  const handleSaveAssociate = async () => {
    if (!assocForm.name.trim() || !assocForm.username.trim() || !assocForm.role) return;

    if (editingAssociate) {
      // ── EDIT: update profile fields in public.users ──
      const updates = {
        full_name: assocForm.name,
        role: assocForm.role,
        username: assocForm.username,
        avatar: getInitials(assocForm.name)
      };

      const { error } = await supabaseAdmin
        .from('users')
        .update(updates)
        .eq('id', editingAssociate.id);

      if (error) {
        alert('Error updating associate: ' + error.message);
        return;
      }

      alert(`✅ Profile updated for ${assocForm.name}`);

    } else {
      // ── CREATE: register new user via Supabase Admin API ──
      if (!assocForm.password.trim()) {
        alert('Please enter a password for the new associate.');
        return;
      }

      if (!supabaseAdmin) {
        alert('Admin client not configured. Please add VITE_SUPABASE_SERVICE_KEY to your .env file.');
        return;
      }

      const email = `${assocForm.username.trim().toLowerCase()}@skillcloud-internal.com`;

      // Admin createUser: no email validation, no rate limits, no confirmation email
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: assocForm.password,
        email_confirm: true, // instantly confirmed — no confirmation email needed
        user_metadata: {
          full_name: assocForm.name,
          username: assocForm.username.trim().toLowerCase(),
        }
      });

      if (authError) {
        alert('Error creating login: ' + authError.message);
        return;
      }

      const newUserId = authData?.user?.id;
      if (!newUserId) {
        alert('User created in Auth but no ID returned. Try again.');
        return;
      }

      // Insert profile into public.users using Admin client to bypass RLS
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert([{
          id: newUserId,
          full_name: assocForm.name,
          username: assocForm.username.trim().toLowerCase(),
          role: assocForm.role,
          avatar: getInitials(assocForm.name)
        }]);

      if (profileError) {
        // Rollback: delete the auth user to avoid orphaned records
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        alert('Error saving profile (auth user rolled back, try again): ' + profileError.message);
        return;
      }

      alert(`✅ Associate "${assocForm.name}" created!\nUsername: ${assocForm.username}\nPassword: ${assocForm.password}`);
    }

    // Refresh associates list from DB
    const { data } = await supabase.from('users').select('*').order('full_name');
    setAssociates(data || []);
    setSettingsView('list');
  };

  const handleDeleteAssociate = async (id) => {
    const assoc = associates.find(a => a.id === id);
    const name = assoc?.full_name || assoc?.username || 'this associate';
    if (!window.confirm(`Delete profile for "${name}"?\n\nNote: This removes their profile data. Their login (Auth) will remain inactive.`)) return;

    const { error } = await supabaseAdmin.from('users').delete().eq('id', id);
    if (error) {
      alert('Error deleting: ' + error.message);
      return;
    }
    setAssociates(prev => prev.filter(a => a.id !== id));
  };

  const filteredSettingsAssociates = associates.filter(a =>
    (a.full_name || '').toLowerCase().includes(settingsSearch.toLowerCase()) ||
    (a.username || '').toLowerCase().includes(settingsSearch.toLowerCase())
  );

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
              <p className="nav-profile-name">{currentUser?.full_name || 'Admin User'}</p>
              <p className="nav-profile-role">Administrator</p>
            </div>
            <div className="nav-avatar">
              {currentUser?.avatar || 'A'}
            </div>
            {showUserMenu && (
              <div className="user-menu-dropdown">
                <button className="user-menu-item" onClick={(e) => { e.stopPropagation(); setShowUserMenu(false); setIsSettingsOpen(true); }}>
                  <Settings size={16} />
                  Settings
                </button>
                <div className="user-menu-divider" style={{ height: '1px', background: '#eee', margin: '4px 0' }} />
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
                <label>Find Associate</label>
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
                        {a.full_name || a.username} - {a.role}
                      </div>
                    ))}
                    {filteredModalAssociates.length === 0 && (
                      <div className="dropdown-item empty">No associates found</div>
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

              <div className="form-group">
                <label>Date</label>
                <div className="standard-input" style={{ background: '#f4f6fb', color: '#6b7a99' }}>
                  {selectedDate ? selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                </div>
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

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => { setIsSettingsOpen(false); setSettingsView('list'); }}>
          <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {settingsView === 'list' ? 'Settings — Manage Associates' : settingsView === 'create' ? 'Add New Associate' : 'Edit Associate'}
              </h3>
              <button className="close-btn" onClick={() => { setIsSettingsOpen(false); setSettingsView('list'); }}><X size={20} /></button>
            </div>

            {settingsView === 'list' ? (
              <div className="settings-body">
                <div className="settings-list-header" style={{ marginBottom: '12px' }}>
                  <p className="settings-subtitle">Manage associate accounts. Each associate can log in with their username and password.</p>
                  <button className="save-btn settings-add-btn" onClick={openCreateAssociate}>
                    <Plus size={16} /> Add Associate
                  </button>
                </div>
                
                {/* Search Filter for Associates */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <div className="search-container">
                    <Search className="search-icon" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search associates by name..." 
                      className="search-input"
                      value={settingsSearch}
                      onChange={(e) => setSettingsSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="settings-associates-list">
                  {filteredSettingsAssociates.map(a => (
                    <div key={a.id} className="settings-associate-row">
                      <div className="settings-assoc-avatar">{a.avatar || getInitials(a.full_name || a.username)}</div>
                      <div className="settings-assoc-info">
                        <p className="settings-assoc-name">{a.full_name || a.username}</p>
                        <p className="settings-assoc-meta">
                          <span className={`role-badge role-badge-${a.role}`}>{a.role}</span>
                          {' · '}
                          <span className="settings-assoc-username">@{a.username}</span>
                        </p>
                      </div>
                      <div className="settings-assoc-actions">
                        <button className="settings-icon-btn" title="Edit" onClick={() => openEditAssociate(a)}>
                          <Edit2 size={16} />
                        </button>
                        <button className="settings-icon-btn settings-delete-btn" title="Delete" onClick={() => handleDeleteAssociate(a.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {associates.length === 0 && (
                    <p className="no-results">No associates. Add one above.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="modal-form">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    className="standard-input"
                    placeholder="e.g. John Doe"
                    value={assocForm.name}
                    onChange={e => setAssocForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select
                    className="standard-input"
                    value={assocForm.role}
                    onChange={e => setAssocForm(f => ({ ...f, role: e.target.value }))}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="" disabled>Select a role...</option>
                    <option value="admin">Admin — Full dashboard access</option>
                    <option value="user">User — Associate view</option>
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      className="standard-input"
                      placeholder="e.g. john.doe"
                      value={assocForm.username}
                      onChange={e => setAssocForm(f => ({ ...f, username: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label>{editingAssociate ? 'Password (leave blank to keep unchanged)' : 'Password'}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showAssocPassword ? 'text' : 'password'}
                        className="standard-input"
                        placeholder={editingAssociate ? 'Leave blank to keep current password' : 'Enter password'}
                        value={assocForm.password}
                        onChange={e => setAssocForm(f => ({ ...f, password: e.target.value }))}
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAssocPassword(v => !v)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7a99' }}
                      >
                        {showAssocPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="cancel-btn" onClick={() => setSettingsView('list')}>Back</button>
                  <button
                    type="button"
                    className="save-btn"
                    onClick={handleSaveAssociate}
                    disabled={
                      !assocForm.name.trim() || !assocForm.username.trim() || !assocForm.role ||
                      (!editingAssociate && !assocForm.password.trim()) // password required only for create
                    }
                  >
                    {editingAssociate ? 'Save Changes' : 'Create Associate'}
                  </button>
                </div>
              </div>
            )}
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
