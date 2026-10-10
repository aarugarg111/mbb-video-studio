# The render machine

Written for: whoever is setting this up — no prior knowledge of the hosting assumed.

## What this is, and why it exists

The studio normally makes the video **inside your browser**. That works in
Chrome and Edge on a computer, and nowhere else: Safari cannot encode video
this way, and phone browsers cannot either. On a phone the studio gets as far
as the shot list and then stops.

This is a small server that makes the video instead. It does exactly what
`npm run render` does on a laptop — opens an invisible Chrome, photographs
every frame, hands the frames to ffmpeg — so a clip made here and a clip made
on a laptop are the same file.

Once it is running, the studio works on a phone.

**It is optional.** Without it, nothing breaks: Chrome and Edge on a computer
carry on as before. The site simply tells a Safari or phone visitor that it
cannot make their video.

## What it needs

A machine with Chrome and ffmpeg on it, which the `Dockerfile` in the root of
this repo sets up for you. It does **not** need to be fast — one render of a
17-second clip takes about a minute — but it does need about 1 GB of memory,
because Chrome and 500 full-size frames are both large.

**It cannot run on Cloudflare Workers or Vercel.** Both of those run small
functions with a few seconds each; this needs a minute of a real machine with a
browser on it. Any host that runs a container will do — Fly.io, Railway,
Render, or a plain virtual machine.

## Running it on your own computer, to try it

From the root of the repo:

```
npm install
node worker/server.js
```

It prints `Render service on :8787`. To check it is alive, open
<http://127.0.0.1:8787/health> — you should see `{"ok":true,...}`.

## Putting it somewhere the team can reach

1. **Pick a password for it.** Any long random string. This is not the team
   password — it is how the studio proves to the render machine that a request
   came from the studio and not from a stranger. Generate one:

   ```
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
   ```

2. **Deploy the container.** With Fly.io, from the root of the repo:

   ```
   fly launch --no-deploy
   fly secrets set RENDER_TOKEN=<the string from step 1>
   fly deploy
   ```

   Note the address it gives you, something like
   `https://mbb-video-studio.fly.dev`.

3. **Tell the studio where it is.** From `cf/`:

   ```
   npx wrangler secret put RENDER_URL
   npx wrangler secret put RENDER_TOKEN
   npm run deploy
   ```

   `RENDER_URL` is the address from step 2. `RENDER_TOKEN` is the same string
   you gave the render machine — they have to match, or every render comes back
   refused.

That is all. The studio notices the render machine on its own and starts
offering to use it.

## Settings

| Name | What it does |
|---|---|
| `PORT` | Which port to listen on. Defaults to 8787. Most hosts set this for you. |
| `RENDER_TOKEN` | The shared password above. **If it is not set, anyone who finds the address can spend your machine's time.** The service says so on startup. |
| `ALLOWED_ORIGIN` | Only needed if a browser calls the service directly, which the studio does not do — it goes through Cloudflare. |

## How it behaves

- **One video at a time.** Two renders at once on a small machine means both
  crawl and it may run out of memory halfway, which looks to whoever is waiting
  like the tool silently breaking. Everyone else is told how many videos are
  ahead of theirs.
- **A finished video is kept for an hour**, then deleted along with its frames.
  Long enough to come back to it after a break; short enough that a day of use
  does not fill the disk.
- **Nothing is stored anywhere else.** No database, no bucket. A restart loses
  whatever was queued, which costs a minute of re-rendering.

## If something goes wrong

**"The render machine did not answer."** It is asleep, restarting, or gone.
Open its `/health` address in a browser. Hosts that scale to zero take a few
seconds to wake up — trying again usually works.

**Every render comes back refused.** `RENDER_TOKEN` differs between the two
places it is set. Set it again in both, and remember that pasting a secret can
carry an invisible trailing newline — the service trims it, but set it
carefully anyway.

**"ffmpeg was not found on PATH."** The container is missing ffmpeg, which
means it was not built from this `Dockerfile`.
