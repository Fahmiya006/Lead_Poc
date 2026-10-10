// Entry point. Wires three things together:
//   Meta webhook  ->  Graph API lookup  ->  Socket.IO push to the mobile app

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const { isValidSignature } = require('./signature');
const { getLeadDetails } = require('./metaApi');
const store = require('./leadStore');

const PORT = process.env.PORT || 3000;
const { VERIFY_TOKEN, APP_SECRET, PAGE_ACCESS_TOKEN } = process.env;

// Fail early with a clear message instead of failing later on the first lead.
for (const name of ['VERIFY_TOKEN', 'APP_SECRET', 'PAGE_ACCESS_TOKEN']) {
  if (!process.env[name]) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Parse JSON, but also keep the untouched body bytes.
// The signature check needs the exact bytes Meta sent, not the parsed object.
app.use(
  express.json({
    verify: (req, res, buffer) => {
      req.rawBody = buffer;
    },
  })
);

// Health check: open the URL in a browser to see the server is up.
app.get('/', (req, res) => {
  res.send(`Lead relay is running. ${store.all().length} lead(s) stored.`);
});

// The app calls this when it opens, to show leads that arrived earlier.
app.get('/leads', (req, res) => {
  res.json(store.all());
});

// Webhook handshake. Meta calls this once when the callback URL is saved
// in the dashboard. We prove we own the URL by echoing hub.challenge back,
// but only if the verify token is the one we chose.
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified by Meta');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Webhook events. Meta calls this every time a lead form is submitted.
app.post('/webhook', (req, res) => {
  const signature = req.get('x-hub-signature-256');

  if (!isValidSignature(req.rawBody, signature, APP_SECRET)) {
    console.warn('Rejected webhook: bad signature');
    return res.sendStatus(401);
  }

  // Answer immediately. If we are slow, Meta thinks we failed and retries.
  res.sendStatus(200);

  if (req.body.object !== 'page') return;

  // One request can carry several entries, each with several changes.
  for (const entry of req.body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field === 'leadgen') {
        processLead(change.value.leadgen_id);
      }
    }
  }
});

async function processLead(leadgenId) {
  // Meta may deliver the same event twice, sometimes only milliseconds
  // apart. has()/markInFlight() run synchronously, back to back, with no
  // `await` between them, so a second delivery arriving while the first
  // is still mid-lookup sees it already claimed and returns immediately
  // instead of racing to add the lead a second time.
  if (store.has(leadgenId)) return;
  store.markInFlight(leadgenId);

  try {
    const lead = await getLeadDetails(leadgenId);
    store.add(lead);
    io.emit('lead:new', lead); // send to every open app
    console.log(`Lead ${lead.id} sent to ${io.engine.clientsCount} app(s)`);
  } catch (err) {
    console.error(`Lead ${leadgenId} failed: ${err.message}`);
  } finally {
    store.settle(leadgenId);
  }
}

io.on('connection', (socket) => {
  console.log(`App connected (${io.engine.clientsCount} online)`);
  socket.on('disconnect', () => console.log('App disconnected'));
});

server.listen(PORT, () => console.log(`Lead relay listening on port ${PORT}`));
