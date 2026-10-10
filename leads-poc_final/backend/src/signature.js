// Checks that a webhook request really came from Meta.
//
// Meta signs every webhook body with our App Secret (HMAC-SHA256) and sends
// the result in the "X-Hub-Signature-256" header as "sha256=<hex>".
// We compute the same hash ourselves and compare. If they differ, the
// request did not come from Meta (or the body was changed on the way).

const crypto = require('crypto');

function isValidSignature(rawBody, signatureHeader, appSecret) {
  if (!rawBody || !signatureHeader || !appSecret) return false;

  const expected =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);

  // timingSafeEqual throws if lengths differ, so check length first.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { isValidSignature };
