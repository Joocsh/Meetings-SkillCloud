import { useEffect, useRef, useState, useCallback } from 'react';

export let notificationPermissionGranted = false;

/**
 * Custom hook that monitors upcoming meetings and fires native OS notifications
 * PLUS provides an in-app toast with a LIVE countdown timer.
 */
export function useUpcomingMeetingAlerts(events, alertMinutesBefore = 10) {
  const notifiedIds = useRef(new Set());
  const visualAlertedIds = useRef(new Set());
  const [activeVisualAlert, setActiveVisualAlert] = useState(null);

  // ─── 1. Request native OS notification permission ───────────────
  useEffect(() => {
    if (!('Notification' in window)) return;

    const currentPerm = Notification.permission;
    notificationPermissionGranted = currentPerm === 'granted';

    if (currentPerm === 'default') {
      Notification.requestPermission().then(perm => {
        notificationPermissionGranted = perm === 'granted';
      });
    }
  }, []);

  // ─── 2. Send a native OS notification ───────────────────────────
  const sendNativeNotification = useCallback((event, minutesUntil) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const minutesText = minutesUntil < 1
        ? 'starting now'
        : `in ${Math.round(minutesUntil)} min`;

      const n = new Notification('📅 Meeting Starting Soon', {
        body: `"${event.title}" is ${minutesText}`,
        icon: '/logo.png',
        tag: `meeting-${event.id}`,
        requireInteraction: true,
        silent: false,
      });

      n.onclick = () => {
        window.focus();
        n.close();
      };

      // Auto-close after 10 min
      setTimeout(() => { try { n.close(); } catch(_){} }, 600000);
    } catch (err) {
      console.warn('[MeetingAlerts] Notification failed:', err);
    }
  }, []);

  // ─── 3. Main check loop — runs every 15 seconds ────────────────
  useEffect(() => {
    if (!events || events.length === 0) return;

    const checkMeetings = () => {
      const now = new Date();

      events.forEach((event) => {
        const start = event.start instanceof Date ? event.start : new Date(event.start);
        const minutesUntil = (start - now) / 1000 / 60;

        if (minutesUntil <= 0 || minutesUntil > alertMinutesBefore) return;

        // ── Native OS notification (once per event) ──
        if (!notifiedIds.current.has(event.id)) {
          if ('Notification' in window && Notification.permission === 'granted') {
            notifiedIds.current.add(event.id);
            sendNativeNotification(event, minutesUntil);
          }
        }

        // ── In-app visual toast (once per event) ──
        if (!visualAlertedIds.current.has(event.id)) {
          visualAlertedIds.current.add(event.id);
          setActiveVisualAlert({
            ...event,
            _alertStart: start,
          });
        }
      });
    };

    checkMeetings();
    const interval = setInterval(checkMeetings, 15000); // every 15 sec

    return () => clearInterval(interval);
  }, [events, alertMinutesBefore, sendNativeNotification]);

  // ─── 4. LIVE countdown timer — updates minutesLeft every 15s ───
  useEffect(() => {
    if (!activeVisualAlert) return;

    const updateCountdown = () => {
      const now = new Date();
      const start = activeVisualAlert._alertStart instanceof Date
        ? activeVisualAlert._alertStart
        : new Date(activeVisualAlert._alertStart);
      const remaining = Math.round((start - now) / 1000 / 60);

      if (remaining <= 0) {
        // Meeting has started → show "Starts NOW" for 2 min then dismiss
        setActiveVisualAlert(prev => prev ? { ...prev, minutesLeft: 0 } : null);
        const autoDismiss = setTimeout(() => setActiveVisualAlert(null), 120000);
        return () => clearTimeout(autoDismiss);
      } else {
        setActiveVisualAlert(prev => prev ? { ...prev, minutesLeft: remaining } : null);
      }
    };

    // Run immediately + every 15 seconds
    updateCountdown();
    const tickInterval = setInterval(updateCountdown, 15000);

    // Auto-dismiss after 10 minutes max
    const maxTimer = setTimeout(() => setActiveVisualAlert(null), 600000);

    return () => {
      clearInterval(tickInterval);
      clearTimeout(maxTimer);
    };
  }, [activeVisualAlert?._alertStart]); // only re-run when a NEW alert appears

  const dismissAlert = () => setActiveVisualAlert(null);

  return { activeVisualAlert, dismissAlert };
}
