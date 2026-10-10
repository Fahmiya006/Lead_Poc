// A very small "database": all leads live in one JSON file on disk.
// Good enough for a PoC, and leads survive a server restart.

const fs = require('fs');
const path = require('path');

const FILE = process.env.LEADS_FILE || path.join(__dirname, '..', 'data', 'leads.json');

// Read the file once at startup. If it doesn't exist yet, start empty.
let leads = [];
try {
  leads = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (err) {
  leads = [];
}

// IDs currently being looked up on the Graph API, seeded synchronously
// before the slow `await` so two near-simultaneous webhook deliveries for
// the same lead can't both pass `has()` and get processed twice. `has()`
// checks this set as well as the saved list.
const inFlight = new Set();

function all() {
  return leads; // newest first
}

function has(id) {
  return inFlight.has(id) || leads.some((lead) => lead.id === id);
}

// Call this synchronously, before the Graph API lookup starts, to claim
// the ID. Release it (via settle()) once the lookup finishes either way,
// so a genuinely failed lookup can be retried on a later webhook delivery.
function markInFlight(id) {
  inFlight.add(id);
}

function settle(id) {
  inFlight.delete(id);
}

function add(lead) {
  leads.unshift(lead); // put the newest lead at the top
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(leads, null, 2));
}

module.exports = { all, has, add, markInFlight, settle };
