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

## If the deploy fails

`Failed to fetch auth token: 400` means the Cloudflare login has expired.
Run `npx wrangler login` again from a normal terminal.

## Running it on this machine first

Create `cf/.dev.vars` (git-ignored) with test values:

```
ANTHROPIC_API_KEY = "sk-ant-..."
TEAM_PASSWORD = "test-password"
SESSION_SECRET = "anything-long"
```

Then `npm run dev` from `cf/` and open the address it prints.
