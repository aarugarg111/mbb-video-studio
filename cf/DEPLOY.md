# Putting the studio on Cloudflare, on one API key

This is for the team version: one web address, one shared password, and
Aryan's Anthropic key held by Cloudflare. Nobody on the team ever sees or
pastes a key.

The videos are still made in each person's own browser, so the only thing
this costs is the one Claude call that turns a script into a shot list.

## What runs where

- The studio page itself is a static site, served by the Worker.
- `/api/login` checks the team password and sets a signed cookie that lasts
  7 days.
- `/api/anthropic/v1/messages` is a proxy. The browser builds the whole
  Claude request; the Worker checks the cookie, adds the API key and passes
  it on. The prompt lives in the studio, not in the Worker, so there is only
  ever one copy of it.
- The model and the maximum length are pinned in `src/worker.js`. Someone
  with the password cannot point the key at a bigger model.
- `/api/render/*` is the other proxy, and it is optional. The video is
  normally made in the browser, which only Chrome and Edge on a computer can
  do. If a render machine is set up, the Worker forwards to it so the studio
  also works on a phone and in Safari. See `worker/README.md` for how to set
  one up — the studio works without it.

## Setting it up (once)

**1. Sign in to Cloudflare.** Open a normal terminal — not through Claude,
because this opens a browser window:

```
npx wrangler login
```

**2. Set the three secrets.** From the `cf/` folder, run these one at a
time. Each prompts you to paste a value:

```
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put TEAM_PASSWORD
npx wrangler secret put SESSION_SECRET
```

- `ANTHROPIC_API_KEY` — a key from console.anthropic.com. Make a **new** one
  named "video studio" so it can be replaced later without disturbing
  anything else.
- `TEAM_PASSWORD` — what the team types to get in. Pick something they can
  be told over a call.
- `SESSION_SECRET` — not typed by anyone; it only signs the login cookie.

**Two more secrets, only if you set up a render machine** so the studio
works on phones and in Safari. `worker/README.md` covers the machine itself;
these two tell the Worker where it is:

```
npx wrangler secret put RENDER_URL
npx wrangler secret put RENDER_TOKEN
```

- `RENDER_URL` — the render machine's address, like
  `https://mbb-video-studio.fly.dev`.
- `RENDER_TOKEN` — the same string the render machine was given. They have
  to match or every render comes back refused.

Leave both unset and nothing breaks: Chrome and Edge carry on rendering in
the browser, and the site tells anyone else that it cannot make their video.
  Any long random text does. For example:
  `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`

**3. Deploy.** From `cf/`:

```
npm run deploy
```

That builds the studio in team mode first, then uploads it. The address it
prints is the one to share.

## Changing something later

Any change to the studio or the Worker: `npm run deploy` from `cf/` again.

To change the password or rotate the key, run the matching
`npx wrangler secret put ...` again and redeploy. Changing `SESSION_SECRET`
signs everyone out, which is the quickest way to cut off access to everybody
at once.

## If somebody gets "Request not allowed"

The report says `403 {"error":{"type":"forbidden","message":"Request not
allowed"}}` and carries a Cloudflare ray and no request id. Anthropic refuses
whole regions at its own edge, before the key is ever looked at, so it reads
exactly like the key being turned off. It is not the key — everybody else is
working on that same key at that same moment.

It is also **not** about the country the person is sitting in. The teammates
this happened to were in Bangalore, and the ray said `HKG`. India is served.
Cloudflare routes by network peering rather than by geography, and a great
deal of Indian traffic reaches it through Hong Kong — so the person was in a
supported country and their request was not. "They're in India, so it can't be
a region problem" is the first conclusion everybody reaches and it is wrong.

The studio now makes the call from inside a Durable Object pinned to the
United States, so it leaves from the same place for everybody whoever opens
the page. `npm run deploy` applies that itself; there is no separate step.

If a report still shows the refusal, read its `called claude from:` line:

- **it names a region** (`enam`, `wnam`) — both pinned regions were refused,
  which is something changing on Anthropic's side rather than a routing
  accident. Quote that line when you report it.
- **it says "this studio is not pinned"** — the deploy did not include the
  Durable Object. Redeploy from `cf/`, and check the output lists
  `env.EGRESS (Egress)` among the bindings.

## If the deploy fails

`Failed to fetch auth token: 400` means the Cloudflare login has expired.
Run `npx wrangler login` again from a normal terminal.

If it complains about Durable Objects or migrations, the account is on a plan
that cannot create them. The studio still works without one — it falls back to
calling Anthropic directly, exactly as it did before — but the region refusal
comes back with it.

## Running it on this machine first

Create `cf/.dev.vars` (git-ignored) with test values:

```
ANTHROPIC_API_KEY = "sk-ant-..."
TEAM_PASSWORD = "test-password"
SESSION_SECRET = "anything-long"
```

Then `npm run dev` from `cf/` and open the address it prints.
