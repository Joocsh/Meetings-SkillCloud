import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';

/**
 * NotificationPermissionBar
 * 
 * Handles the notification permission flow across all browsers.
 * Edge & Firefox use "quiet" prompts (small icon in address bar),
 * so we guide the user after clicking Enable.
 */
export default function NotificationPermissionBar() {
  const [permState, setPermState] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'granted'
  );
  const [showInstructions, setShowInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Poll permission state every 2 seconds (catches when user grants via browser UI)
  useEffect(() => {
    if (!('Notification' in window)) return;
    
    const interval = setInterval(() => {
      const current = Notification.permission;
      if (current !== permState) {
        setPermState(current);
        if (current === 'granted') {
          // Permission was just granted! Send a confirmation notification
          try {
            new Notification('✅ Notifications enabled!', {
              body: 'You will now receive meeting alerts even when on other tabs or apps.',
              icon: '/logo.png',
            });
          } catch(_) {}
          setShowInstructions(false);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [permState]);

  if (!('Notification' in window) || permState === 'granted' || dismissed) {
    return null;
  }

  const handleEnableClick = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermState(result);

      if (result === 'granted') {
        try {
          new Notification('✅ Notifications enabled!', {
            body: 'You will now receive meeting alerts even when on other tabs or apps.',
            icon: '/logo.png',
          });
        } catch(_) {}
        setShowInstructions(false);
      } else if (result === 'default') {
        // Permission prompt might have been silently shown (Edge/Firefox quiet mode)
        setShowInstructions(true);
      } else {
        // Denied
        setPermState('denied');
      }
    } catch (err) {
      // Fallback: show instructions
      setShowInstructions(true);
    }
  };

  if (permState === 'denied') {
    return (
      <div className="notif-permission-alert" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>
        <Bell size={16} />
        <span>
          Notifications are blocked. To enable: click the <strong>🔒 lock icon</strong> in the address bar → Site permissions → Notifications → Allow.
        </span>
      </div>
    );
  }

  // Default state — not yet decided
  return (
    <div className="notif-permission-alert">
      <Bell size={16} />
      {showInstructions ? (
        <span>
          👆 Look for a <strong>notification icon or popup</strong> in your address bar (top of browser) and click <strong>"Allow"</strong>. 
          If you don't see it, click <strong>🔒 the lock icon</strong> → Site permissions → Notifications → Allow.
        </span>
      ) : (
        <span>Enable browser notifications to get meeting alerts even when you're on other apps.</span>
      )}
      <button onClick={handleEnableClick}>
        {showInstructions ? 'Try Again' : 'Enable'}
      </button>
      <button 
        onClick={() => setDismissed(true)}
        style={{ background: 'transparent', color: 'inherit', padding: '4px 8px', fontSize: '16px', border: 'none', cursor: 'pointer', opacity: 0.6 }}
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
