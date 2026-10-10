// A custom hook that owns all the networking for the leads screen.
// The screen just calls useLiveLeads() and gets back the list and the
// connection state; it doesn't need to know about sockets at all.

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../config';

// Merge a freshly fetched snapshot into whatever's already on screen,
// instead of replacing it outright. A `lead:new` push can arrive while the
// `/leads` fetch below is still in flight (the socket connects and starts
// pushing before the fetch resolves); a plain setLeads(fetched) would then
// overwrite that lead right back out of the list. Keyed merge by id avoids
// that regardless of which one lands first, and keeps the result sorted
// newest-first by submittedAt.
function mergeById(current, incoming) {
  const byId = new Map(current.map((lead) => [lead.id, lead]));
  for (const lead of incoming) byId.set(lead.id, lead);
  return [...byId.values()].sort(
    (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
  );
}

export function useLiveLeads() {
  const [leads, setLeads] = useState([]);
  const [online, setOnline] = useState(false);
  const [latestId, setLatestId] = useState(null); // which card to highlight
  // 'loading' | 'ready' | 'error' — drives the empty/loading/error states
  // in App.js. Starts 'loading' until the very first /leads fetch settles.
  const [status, setStatus] = useState('loading');
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket'] });

    // Runs on the first connect AND on every reconnect, so if the phone
    // lost network for a while we still pick up the leads we missed.
    socket.on('connect', async () => {
      setOnline(true);
      try {
        // ngrok's free tier shows an HTML "you're about to visit..."
        // interstitial to plain browser requests before the real response;
        // this header tells it to skip that and return the API response
        // directly. Harmless against a non-ngrok host (e.g. Render), which
        // just ignores the header.
        const response = await fetch(`${SERVER_URL}/leads`, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const fetched = await response.json();
        setLeads((current) => mergeById(current, fetched));
        setStatus('ready');
        hasLoadedOnce.current = true;
      } catch (err) {
        console.log('Could not load saved leads:', err.message);
        // Only show the error state if we've never successfully loaded —
        // a reconnect hiccup after that shouldn't blank out a working list.
        if (!hasLoadedOnce.current) setStatus('error');
      }
    });

    socket.on('disconnect', () => setOnline(false));

    // The live part: the server pushes each new lead here.
    socket.on('lead:new', (lead) => {
      setLeads((current) => mergeById(current, [lead]));
      setLatestId(lead.id);
      setStatus('ready');
      hasLoadedOnce.current = true;
    });

    // Cleanup when the screen is closed.
    return () => socket.disconnect();
  }, []);

  return { leads, online, latestId, status };
}
