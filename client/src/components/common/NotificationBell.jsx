import React, { useState, useEffect, useRef } from 'react';
import { Bell, Sparkles, PartyPopper, Calendar, Check, Volume2, ShieldCheck, ExternalLink } from 'lucide-react';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  requestPushPermissionAndRegister,
  triggerFeatureAlert,
  triggerHolidayAlert
} from '../../services/notifications.js';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [pushStatus, setPushStatus] = useState(() => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'));
  const [busy, setBusy] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function loadNotifications() {
    try {
      const data = await fetchNotifications();
      if (data?.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount ?? data.notifications.filter(n => !n.isRead).length);
      }
    } catch {}
  }

  async function handleMarkRead(id, actionUrl) {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      if (actionUrl) window.location.href = actionUrl;
    } catch {}
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  }

  async function enablePush() {
    setBusy(true);
    try {
      const result = await requestPushPermissionAndRegister();
      setPushStatus(result.status);
      if (result.status === 'granted') {
        await loadNotifications();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleTriggerHoliday() {
    setBusy(true);
    try {
      await triggerHolidayAlert();
      await loadNotifications();
    } finally {
      setBusy(false);
    }
  }

  async function handleTriggerFeature() {
    setBusy(true);
    try {
      await triggerFeatureAlert();
      await loadNotifications();
    } finally {
      setBusy(false);
    }
  }

  const filtered = notifications.filter(item => {
    if (activeTab === 'features') return item.type === 'feature';
    if (activeTab === 'holidays') return item.type === 'holiday' || item.type === 'event';
    return true;
  });

  return (
    <div className="relative inline-block" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications (${unreadCount} unread)`}
        style={{
          position: 'relative',
          padding: '8px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-color, #e2e8f0)',
          background: open ? 'var(--bg-active, #f1f5f9)' : 'transparent',
          cursor: 'pointer',
          color: 'var(--text-primary, #0f172a)'
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              minWidth: '16px',
              height: '16px',
              padding: '0 4px',
              borderRadius: '9999px',
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 2px var(--bg-surface, #ffffff)'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notification-dropdown card"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '360px',
            maxWidth: '92vw',
            maxHeight: '520px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            padding: 0,
            boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid var(--border-color, #cbd5e1)'
          }}
        >
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface-alt, #f8fafc)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <b style={{ fontSize: '15px' }}>Notifications</b>
              {unreadCount > 0 && (
                <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{ fontSize: '12px', color: 'var(--primary-color, #16a34a)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color, #e2e8f0)', padding: '4px 8px', gap: '4px', background: 'var(--bg-surface, #ffffff)' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'features', label: '🚀 Features' },
              { id: 'holidays', label: '🌾 Holidays & Events' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === tab.id ? 'var(--bg-active, #f1f5f9)' : 'transparent',
                  fontWeight: activeTab === tab.id ? '700' : '500',
                  color: activeTab === tab.id ? 'var(--primary-color, #16a34a)' : 'inherit',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Push Permission Prompt */}
          {pushStatus !== 'granted' && (
            <div style={{ padding: '8px 12px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📲 Get instant festival & feature alerts</span>
              <button
                type="button"
                onClick={enablePush}
                disabled={busy}
                style={{ padding: '4px 8px', fontSize: '11px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
              >
                Enable
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: '320px', padding: '4px 0' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No notifications in this category.
              </div>
            ) : (
              filtered.map(item => {
                const isHoliday = item.type === 'holiday';
                const isFeature = item.type === 'feature';
                const isEvent = item.type === 'event';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleMarkRead(item.id, item.actionUrl)}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      gap: '10px',
                      borderBottom: '1px solid var(--border-color, #f1f5f9)',
                      background: item.isRead ? 'transparent' : 'var(--bg-unread, rgba(34, 197, 94, 0.05))',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        background: isHoliday ? '#fef3c7' : isFeature ? '#dbeafe' : '#ede9fe',
                        color: isHoliday ? '#d97706' : isFeature ? '#2563eb' : '#7c3aed'
                      }}
                    >
                      {isHoliday ? <PartyPopper size={16} /> : isFeature ? <Sparkles size={16} /> : <Calendar size={16} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: item.isRead ? '600' : '700', color: 'var(--text-primary, #0f172a)' }}>
                          {item.title}
                        </span>
                        {!item.isRead && (
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                        )}
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-secondary, #475569)', lineHeight: '1.4' }}>
                        {item.body}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Trigger Actions for Testing Live Notifications */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', gap: '6px', background: 'var(--bg-surface-alt, #f8fafc)' }}>
            <button
              type="button"
              onClick={handleTriggerFeature}
              disabled={busy}
              style={{ flex: 1, padding: '5px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontWeight: '600' }}
            >
              + Test Feature
            </button>
            <button
              type="button"
              onClick={handleTriggerHoliday}
              disabled={busy}
              style={{ flex: 1, padding: '5px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', cursor: 'pointer', fontWeight: '600' }}
            >
              + Test Holiday
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
