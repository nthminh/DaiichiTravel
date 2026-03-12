import React, { useState, useEffect, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../App';
import { transportService } from '../services/transportService';

interface BookingNotif {
  id: string;
  customerName: string;
  route: string;
  time: string;
  type: string;
}

export const UrgencyNotification = ({ language }: { language: Language }) => {
  const [notifications, setNotifications] = useState<BookingNotif[]>([]);
  const initializedRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const timeoutIdsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const unsubscribe = transportService.subscribeToBookings((bookings) => {
      if (!initializedRef.current) {
        // First snapshot — record all existing booking IDs, don't show popups
        bookings.forEach((b) => knownIdsRef.current.add(b.id));
        initializedRef.current = true;
        return;
      }

      // Find genuinely new bookings added after component mount
      const newBookings = bookings.filter((b) => !knownIdsRef.current.has(b.id));
      if (newBookings.length === 0) return;

      newBookings.forEach((b) => knownIdsRef.current.add(b.id));

      const newNotifs: BookingNotif[] = newBookings.map((b) => ({
        id: b.id,
        customerName: b.customerName || '',
        route: b.route || '',
        time: b.time || '',
        type: b.type || 'TRIP',
      }));

      setNotifications((prev) => [...newNotifs, ...prev].slice(0, 5));

      // Auto-dismiss each new notification after 8 seconds
      newNotifs.forEach((n) => {
        const tid = setTimeout(() => {
          setNotifications((prev) => prev.filter((x) => x.id !== n.id));
          timeoutIdsRef.current.delete(n.id);
        }, 8000);
        timeoutIdsRef.current.set(n.id, tid);
      });
    });

    return () => {
      unsubscribe();
      // Clear all pending auto-dismiss timers on unmount
      timeoutIdsRef.current.forEach((tid) => clearTimeout(tid));
      timeoutIdsRef.current.clear();
    };
  }, []);

  const dismiss = (id: string) => {
    // Cancel the auto-dismiss timer if user dismisses early
    const tid = timeoutIdsRef.current.get(id);
    if (tid !== undefined) {
      clearTimeout(tid);
      timeoutIdsRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div
      className="fixed bottom-8 right-8 z-50 space-y-3 pointer-events-none"
      aria-live="polite"
      aria-label={language === 'vi' ? 'Thông báo đặt chỗ mới' : 'New booking notifications'}
    >
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="max-w-sm pointer-events-auto"
            role="alert"
          >
            <div className="bg-white p-5 rounded-3xl shadow-2xl border-2 border-daiichi-red flex gap-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-daiichi-red" />
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-daiichi-red shrink-0" aria-hidden="true">
                <Bell size={22} className="animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-daiichi-red uppercase tracking-widest mb-1">
                  {language === 'vi' ? 'Đặt chỗ mới!' : 'New Booking!'}
                </p>
                <p className="text-sm font-bold text-gray-800 truncate">{n.customerName}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                  {n.route}{n.time ? ` • ${n.time}` : ''}
                </p>
              </div>
              <button
                onClick={() => dismiss(n.id)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={language === 'vi' ? 'Đóng thông báo' : 'Dismiss notification'}
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};


