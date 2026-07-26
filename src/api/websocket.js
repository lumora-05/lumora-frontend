import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { API_BASE_URL } from './axiosClient';

export const DEFAULT_TOPICS = [
  '/topic/orders',
  '/topic/kitchen',
  '/topic/cashier',
  '/topic/payments',
  '/topic/dashboard',
  '/topic/reviews'
];

let client = null;
const topicListeners = new Map();
const topicSubscriptions = new Map();

function parseBody(body) {
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function subscribeTopic(topic) {
  if (!client?.connected || topicSubscriptions.has(topic)) return;

  const subscription = client.subscribe(topic, (message) => {
    const event = { topic, body: parseBody(message.body) };
    const listeners = topicListeners.get(topic);
    listeners?.forEach((listener) => listener(event));
  });

  topicSubscriptions.set(topic, subscription);
}

function ensureClient() {
  if (client?.active) return;

  client = new Client({
    webSocketFactory: () => new SockJS(`${API_BASE_URL}/ws`),
    reconnectDelay: 3000,
    onConnect: () => {
      topicListeners.forEach((_, topic) => subscribeTopic(topic));
    },
    onWebSocketClose: () => {
      topicSubscriptions.clear();
    }
  });

  client.activate();
}

export function connectWebSocket(onEvent, topics = DEFAULT_TOPICS) {
  const normalizedTopics = Array.from(
    new Set((Array.isArray(topics) ? topics : [topics]).filter(Boolean))
  );
  const token = Symbol('websocket-listener');

  normalizedTopics.forEach((topic) => {
    if (!topicListeners.has(topic)) topicListeners.set(topic, new Map());
    topicListeners.get(topic).set(token, onEvent);
    subscribeTopic(topic);
  });

  ensureClient();
  return { token, topics: normalizedTopics };
}

export function disconnectWebSocket(handle) {
  if (!handle) {
    topicSubscriptions.forEach((subscription) => subscription.unsubscribe());
    topicSubscriptions.clear();
    topicListeners.clear();
    if (client?.active) void client.deactivate();
    client = null;
    return;
  }

  handle.topics.forEach((topic) => {
    const listeners = topicListeners.get(topic);
    listeners?.delete(handle.token);

    if (!listeners?.size) {
      topicListeners.delete(topic);
      topicSubscriptions.get(topic)?.unsubscribe();
      topicSubscriptions.delete(topic);
    }
  });

  if (!topicListeners.size && client?.active) {
    void client.deactivate();
    client = null;
    topicSubscriptions.clear();
  }
}
