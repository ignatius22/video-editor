import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef(null);
  const [jobs, setJobs] = useState({});

  useEffect(() => {
    const socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const updateJob = (event, data) => {
      const id = data.videoId || data.imageId;
      if (!id) return;
      setJobs(prev => ({
        ...prev,
        [id]: { ...prev[id], ...data, event, updatedAt: Date.now() },
      }));
    };

    socket.on('job:queued', (d) => updateJob('queued', d));
    socket.on('job:started', (d) => updateJob('started', d));
    socket.on('job:progress', (d) => updateJob('progress', d));
    socket.on('job:completed', (d) => updateJob('completed', d));
    socket.on('job:failed', (d) => updateJob('failed', d));

    return () => socket.disconnect();
  }, []);

  const subscribe = useCallback((resourceId) => {
    socketRef.current?.emit('subscribe', resourceId);
  }, []);

  const unsubscribe = useCallback((resourceId) => {
    socketRef.current?.emit('unsubscribe', resourceId);
  }, []);

  const clearJob = useCallback((resourceId) => {
    setJobs(prev => {
      const next = { ...prev };
      delete next[resourceId];
      return next;
    });
  }, []);

  return { jobs, subscribe, unsubscribe, clearJob };
}
