# Putting the studio on Cloudflare, on one API key

This is for the team version: one web address, one shared password, and
Aryan's Anthropic key held by Cloudflare. Nobody on the team ever sees or
pastes a key.

The videos are still made in each person's own browser, and the one call
that turns a script into a shot list runs on Gemini's free tier — so the
studio costs nothing to run.

## What runs where

- The studio page itself is a static site, served by the Worker.
- `/api/login` checks the team password and sets a signed cookie that lasts
  7 days.
- `/api/gemini/...` is a proxy. The browser builds the whole request; the
  Worker checks the cookie, adds the API key and passes it on. The prompt
  lives in the studio, not in the Worker, so there is only ever one copy
  of it.
- The model is picked from a list in `src/worker.js` and the URL is built
  from it, so somebody with the password cannot point the key at another
  model or another endpoint.
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
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put TEAM_PASSWORD
npx wrangler secret put SESSION_SECRET
```

- `GEMINI_API_KEY` — a **free** key from
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey). This is
  the one the studio reads scripts with, and it is why the studio costs
  nothing to run.
- `TEAM_PASSWORD` — what the team types to get in. Pick something they can
  be told over a call.
- `SESSION_SECRET` — not typed by anyone; it only signs the login cookie.

There is no Anthropic key any more. The studio used to read scripts with
Claude and that was the only thing it ever cost anybody; it reads them on
Gemini's free tier now and nothing else. If you set one before, you can
delete it: `npx wrangler secret delete ANTHROPIC_API_KEY`.

Without `GEMINI_API_KEY` the Worker still serves the page and still signs
people in, and says plainly that the key is missing when somebody tries to
read a script. It does not refuse to start — a blank screen would say far
less than the message does.

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

This was an **Anthropic** refusal and it cannot happen any more: the studio
no longer calls Anthropic at all. The whole arrangement built to survive it —
a Durable Object that pinned the call to a US region — has gone with it.

It is worth keeping the lesson, because the same thing could happen with any
provider. Anthropic refused whole regions at its own edge, before the key was
looked at, so it read exactly like the key being switched off while everybody
else worked fine on that same key. And it was **not** about the country the
person was in: the teammates it happened to were in Bangalore and the
Cloudflare ray said `HKG`. India is served. Cloudflare routes by network
peering rather than geography, and a great deal of Indian traffic reaches it
through Hong Kong — so the person was in a supported country and their
request was not. "They're in India, so it can't be a region problem" is the
first conclusion everybody reaches, and it is wrong.

If Google ever refuses this way, that is the shape to look for, and the old
fix is in the git history.

## If the deploy fails

`Failed to fetch auth token: 400` means the Cloudflare login has expired.
Run `npx wrangler login` again from a normal terminal.

If it complains about Durable Objects or migrations, say so — the studio no
longer declares one, so that would mean a leftover from an earlier deploy
rather than anything this configuration asks for.

## Running it on this machine first

Create `cf/.dev.vars` (git-ignored) with test values:

```
GEMINI_API_KEY = "AIza..."
TEAM_PASSWORD = "test-password"
SESSION_SECRET = "anything-long"
```

Then `npm run dev` from `cf/` and open the address it prints.
