import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8080/ws';

/**
 * Custom hook để kết nối WebSocket STOMP
 * @param {string} topic - Topic để subscribe (ví dụ: '/topic/prices')
 * @param {function} onMessage - Callback khi nhận message
 * @param {boolean} enabled - Bật/tắt kết nối
 */
export function useWebSocket(topic, onMessage, enabled = true) {
  const clientRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);

  // Keep callback ref updated
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled || !topic) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: () => {}, // silence debug logs
    });

    client.onConnect = () => {
      setConnected(true);
      client.subscribe(topic, (message) => {
        try {
          const data = JSON.parse(message.body);
          onMessageRef.current(data);
        } catch (e) {
          console.error('WS parse error:', e);
        }
      });
    };

    client.onDisconnect = () => setConnected(false);
    client.onStompError = () => setConnected(false);

    client.activate();
    clientRef.current = client;

    return () => {
      if (client.active) {
        client.deactivate();
      }
    };
  }, [topic, enabled]);

  return { connected };
}

/**
 * Hook tiện ích: subscribe nhiều topics cùng lúc
 */
export function useMultiWebSocket(subscriptions, enabled = true) {
  const clientRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const subsRef = useRef(subscriptions);

  useEffect(() => {
    subsRef.current = subscriptions;
  }, [subscriptions]);

  useEffect(() => {
    if (!enabled || subscriptions.length === 0) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: () => {},
    });

    client.onConnect = () => {
      setConnected(true);
      subsRef.current.forEach(({ topic, handler }) => {
        client.subscribe(topic, (message) => {
          try {
            const data = JSON.parse(message.body);
            handler(data);
          } catch (e) {
            console.error('WS parse error:', e);
          }
        });
      });
    };

    client.onDisconnect = () => setConnected(false);
    client.onStompError = () => setConnected(false);

    client.activate();
    clientRef.current = client;

    return () => {
      if (client.active) client.deactivate();
    };
  }, [enabled]);

  return { connected };
}
