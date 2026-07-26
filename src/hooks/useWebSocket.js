import { useEffect, useState } from 'react';
import { connectWebSocket, disconnectWebSocket, DEFAULT_TOPICS } from '../api/websocket';

export function useWebSocket(topics = DEFAULT_TOPICS) {
  const [event, setEvent] = useState(null);
  const topicKey = (Array.isArray(topics) ? topics : [topics]).filter(Boolean).join('|');

  useEffect(() => {
    const resolvedTopics = topicKey ? topicKey.split('|') : DEFAULT_TOPICS;
    const handle = connectWebSocket(setEvent, resolvedTopics);
    return () => disconnectWebSocket(handle);
  }, [topicKey]);

  return event;
}
