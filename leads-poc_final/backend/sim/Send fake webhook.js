// Sends a webhook POST to your own running backend (http://localhost:3000/webhook)
// that looks exactly like what Meta would send for a real leadgen event —
// same shape, same HMAC-SHA256 signature, using your real APP_SECRET from .env.
//
// Use this only to prove the pipeline works end-to-end (Graph API fetch +
// Socket.IO push + phone update) when Meta's own webhook delivery from the
// Lead Ads Testing Tool isn't firing. The leadgen_id below is a REAL lead
// Meta already captured on your Page, fetched via the Graph API — so the
// Graph API lookup inside your server will succeed with real data, not a
// fake dummy.
//
// Run from the backend/ folder:   node sim/send-fake-webhook.js

const http = require('http');
const crypto = require('crypto');
require('dotenv').config();

const APP_SECRET = process.env.APP_SECRET;
if (!APP_SECRET) {
  console.error('Missing APP_SECRET in .env — cannot sign the request.');
  process.exit(1);
}

const PAGE_ID = '1269002146306430';
const FORM_ID = '1541859691319363';
const LEADGEN_ID = '975904705567148'; // the real lead fetched via Graph API

const payload = {
  object: 'page',
  entry: [
    {
      id: PAGE_ID,
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'leadgen',
          value: {
            form_id: FORM_ID,
            leadgen_id: LEADGEN_ID,
            created_time: Math.floor(Date.now() / 1000),
            page_id: PAGE_ID,
          },
        },
      ],
    },
  ],
};

const body = JSON.stringify(payload);
const signature =
  'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');

const req = http.request(
  {
    hostname: 'localhost',
    port: 3000,
    path: '/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'X-Hub-Signature-256': signature,
    },
  },
  (res) => {
    console.log('Backend responded with status:', res.statusCode);
    res.on('data', () => {});
    res.on('end', () => console.log('Done — check your backend terminal and phone.'));
  }
);

req.on('error', (err) => {
  console.error('Could not reach http://localhost:3000 — is the backend running?', err.message);
});

req.write(body);
req.end();