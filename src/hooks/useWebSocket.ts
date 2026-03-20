import { useState, useEffect } from 'react';

/**
 * useWebSocket – manages a persistent WebSocket connection with automatic
 * exponential-backoff reconnection.
 *
 * Returns the current WebSocket instance and a list of real-time booking
 * notifications (automatically removed after 5 seconds each).
 */
export function useWebSocket() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectAttempts = 0;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;

    const MAX_RECONNECT_ATTEMPTS = 10;
    const BASE_DELAY_MS = 1000;
    const MAX_DELAY_MS = 30000;

    const connect = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}`);

      socket.onopen = () => {
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_BOOKING') {
            const id = Date.now();
            setNotifications(prev => [{ ...data, id }, ...prev].slice(0, 5));
            // Auto-remove notification after 5 seconds
            setTimeout(() => {
              setNotifications(prev => prev.filter(n => n.id !== id));
            }, 5000);
          }
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      socket.onclose = () => {
        if (unmounted || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, reconnectAttempts), MAX_DELAY_MS);
        reconnectAttempts++;
        reconnectTimeout = setTimeout(connect, delay);
      };

      setWs(socket);
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      socket?.close();
    };
  }, []);

  return { ws, notifications };
}
