# Meta Lead Ads → React Native live leads (PoC)

When a lead form is submitted on Meta, the lead appears in an already-open
React Native screen with no action on the device.

## How it works

```
Meta Lead Testing Tool
        │  (1) POST /webhook  { leadgen_id }   signed with the App Secret
        ▼
Node.js backend (Express)
        │  (2) check signature
        │  (3) GET graph.facebook.com/{leadgen_id}  → name, email, phone…
        │  (4) save to data/leads.json
        │  (5) io.emit('lead:new', lead)
        ▼
React Native app (Socket.IO client)  → adds the lead to the top of the list
```

```
backend/src/index.js       routes, webhook handling, Socket.IO
backend/src/signature.js   checks the webhook really came from Meta
backend/src/metaApi.js     fetches lead details from the Graph API
backend/src/leadStore.js   saves leads to a JSON file
app/App.js                 the leads screen
app/src/useLiveLeads.js    hook: loads leads and listens for new ones
app/src/LeadCard.js        one lead in the list
app/config.js              backend URL
```

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # fill in the values (steps 2 and 3 give you them)
npm start
```

In a second terminal, make it public:

```bash
ngrok http 3000
```

Copy the `https://….ngrok-free.app` URL. Opening it in a browser should show
"Lead relay is running".

### 2. Meta side

1. Create a Facebook Page (any name).
2. Create a lead form on the Page: Meta Business Suite → All tools → Instant Forms → Create form (name, email, phone is enough). Publish it.
3. Go to developers.facebook.com → My Apps → Create App → type **Business**.
4. App settings → Basic → copy the **App secret** into `.env` as `APP_SECRET`.
5. In the app dashboard add the **Webhooks** product.
   - Choose object **Page** → Subscribe to this object.
   - Callback URL: `https://<your-ngrok-url>/webhook`
   - Verify token: the same string as `VERIFY_TOKEN` in `.env`
   - After it verifies, find the **leadgen** field and click **Subscribe**.

### 3. Token and Page subscription (Graph API Explorer)

1. Open developers.facebook.com/tools/explorer and select your app.
2. Get User Access Token with these permissions:
   `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`,
   `pages_manage_ads`, `leads_retrieval`, `ads_management`
3. In the "User or Page" dropdown pick your Page → this gives the **Page access token**.
   Paste it into `.env` as `PAGE_ACCESS_TOKEN` and restart the backend.
4. Install the app on the Page: change method to **POST** and run
   `{page-id}/subscribed_apps?subscribed_fields=leadgen`
   It should return `{"success": true}`.

### 4. App

```bash
npx create-expo-app@latest leads-app --template blank
cd leads-app
npx expo install socket.io-client
# copy App.js, config.js and the src/ folder from this repo's app/ folder into leads-app/
# put your ngrok URL in config.js
npx expo start
```

Open it in Expo Go on your phone or press `a` / `i` for an emulator.
The header should show **LIVE**.

### 5. Test

Open developers.facebook.com/tools/lead-ads-testing, pick your Page and form,
click **Create lead**. The lead appears in the app within a second or two.
(Use "Delete lead" before creating another one for the same form.)
"Track status" on that page shows whether the webhook reached your server.

## Assumptions

- Leads are stored in a JSON file, not a real database. The brief asks to avoid a
  database; a file was chosen over pure in-memory storage so a lead submitted
  while recording isn't lost if the server restarts mid-demo. Not safe for
  concurrent writes or scale — a real system would use a proper store.
- One Page and one Page access token, set through `.env`.
- The token comes from Graph API Explorer and is short-lived (fine for a demo; a
  real system would use a long-lived or system-user token).
- The Meta app is in Development mode, so it only works for Pages managed by
  the app's own admins/testers. No App Review was done.
- No login in the mobile app; anyone with the backend URL can read leads.
- The app must be open (foreground) to receive leads; no push notifications.
- Leads that arrive while the app is closed or offline are loaded from `GET /leads` on the next connect.
- If the Graph API lookup fails, it's retried once after a short delay (covers a
  transient blip); a failure that persists through the retry is logged and the
  lead is dropped — Meta has already received its 200 for the webhook by then,
  so it won't resend the event, and there's no separate retry queue behind that
  one retry.
- Leads created with the Lead Ads Testing Tool contain dummy placeholder values
  (not real names/emails) — expected, not a bug, and called out in the demo video.

## Troubleshooting

| Problem | Likely cause |
| --- | --- |
| Server exits with "Missing … in .env" | That value is not filled in `.env` |
| Webhook won't verify | Backend/ngrok not running, or verify token doesn't match `.env` |
| Log says "Rejected webhook: bad signature" | `APP_SECRET` is wrong or from a different Meta app |
| Testing tool says no app subscribed | Step 3.4 (`subscribed_apps`) not done, or leadgen field not subscribed |
| Log says "Lead … failed: Graph API: …" (after a ~1s pause) | Token expired or missing `leads_retrieval` – generate a new Page token. The pause means the built-in retry already ran once and failed both times, so this is a real error, not a blip. |
| App shows RECONNECTING | Wrong URL in `config.js` (must be the https ngrok URL, no trailing slash) |
| App shows "Couldn't load leads" | The `/leads` fetch failed outright — backend isn't reachable at that URL at all (not just slow). Check `config.js` and that the backend/ngrok are running. |
| ngrok URL changed | Update it in the Meta webhook settings and in `config.js` |
| App works in a real browser but `/leads` looks like it hangs from the app | Shouldn't happen — the app sends `ngrok-skip-browser-warning` to skip ngrok's free-tier interstitial page. If it still happens, check the backend terminal for whether the request arrived at all. |

## Meta configuration notes

- Request only the permissions the app actually uses — `leads_retrieval` for
  reading lead data, plus the ones in step 3.2 for Page/token access. Don't add
  extra permissions "just in case."
- The Page must be subscribed to the app's `leadgen` webhook field (steps 2.5
  and 3.4 above) *in addition to* a verified callback URL — missing either one
  means the Testing Tool will happily create a lead with no webhook firing at
  all, which looks identical to a bug in this code.
- In Development mode, only Facebook accounts with a role on the app (admin,
  developer, tester) can generate events that reach the webhook — that's why
  this setup works for your own test Page but wouldn't for a stranger's.
