// Talks to Meta's Graph API.
//
// The webhook only tells us "lead 123 was created". To get the actual
// answers (name, email, phone...) we have to ask the Graph API for that lead.

const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v25.0';

// Small delay helper for the retry below.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Does the actual Graph API call once. Token goes in the Authorization
// header (bearer), not the query string, so it never ends up in server
// access logs or in anything that prints the request URL.
async function fetchLeadOnce(leadgenId) {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}` +
    `?fields=id,created_time,form_id,field_data`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.PAGE_ACCESS_TOKEN}` },
  });
  const data = await response.json();

  if (data.error) {
    throw new Error(`Graph API: ${data.error.message}`);
  }

  // Meta returns answers as a list:
  //   [{ name: 'email', values: ['a@b.com'] }, { name: 'full_name', values: ['Asha'] }]
  // The app wants a plain object:
  //   { email: 'a@b.com', full_name: 'Asha' }
  const answers = {};
  for (const field of data.field_data || []) {
    answers[field.name] = (field.values || []).join(', ');
  }

  return {
    id: data.id,
    formId: data.form_id,
    submittedAt: data.created_time,
    answers,
  };
}

// Meta already got its 200 for the webhook by the time we call this, so it
// will not resend the event if this lookup fails. A transient network blip
// or a momentary Graph API hiccup would otherwise drop the lead silently.
// One retry after a short wait covers that without masking a real problem
// (a bad token, a deleted lead) — those fail the same way twice and still
// surface to the caller.
async function getLeadDetails(leadgenId, { retries = 1, retryDelayMs = 1000 } = {}) {
  try {
    return await fetchLeadOnce(leadgenId);
  } catch (err) {
    if (retries <= 0) throw err;
    await sleep(retryDelayMs);
    return getLeadDetails(leadgenId, { retries: retries - 1, retryDelayMs });
  }
}

module.exports = { getLeadDetails };
