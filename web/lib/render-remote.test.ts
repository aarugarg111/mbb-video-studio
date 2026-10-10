import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRemotely, canRenderRemotely, describe, GIVE_UP_MS } from './render-remote';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/* A render machine that answers from a script of replies, so a whole
 * submit-poll-download round trip runs in no time at all. */
function machine(replies: Array<(url: string) => Response>) {
  const seen: string[] = [];
  let i = 0;
  const fetchImpl = (async (url: string | URL | Request) => {
    const u = String(url);
    seen.push(u);
    const reply = replies[Math.min(i++, replies.length - 1)];
    return reply(u);
  }) as unknown as typeof fetch;
  return { fetchImpl, seen };
}

const noWait = async () => {};

test('a clip is submitted, polled and fetched', async () => {
  const { fetchImpl, seen } = machine([
    () => json({ id: 'job7', state: 'rendering' }, 202),
    () => json({ state: 'rendering', done: 100, total: 228, place: 0 }),
    () => json({ state: 'done', done: 228, total: 228, place: 0, ready: true }),
    () => new Response('mp4 bytes', { headers: { 'Content-Type': 'video/mp4' } })
  ]);

  const blob = await renderRemotely('video: clip', { fetchImpl, wait: noWait });

  assert.equal(await blob.text(), 'mp4 bytes');
  assert.deepEqual(seen, ['/api/render', '/api/render/job7', '/api/render/job7', '/api/render/job7/video']);
});

test('progress comes through as frames done out of the total', async () => {
  const { fetchImpl } = machine([
    () => json({ id: 'j', state: 'rendering' }, 202),
    () => json({ state: 'rendering', done: 0, total: 504, place: 0 }),
    () => json({ state: 'rendering', done: 252, total: 504, place: 0 }),
    () => json({ state: 'done', ready: true }),
    () => new Response('bytes')
  ]);

  const seen: Array<[number, number]> = [];
  await renderRemotely('x', { fetchImpl, wait: noWait, onProgress: (d, t) => seen.push([d, t]) });

  assert.deepEqual(seen.slice(0, 2), [[0, 504], [252, 504]]);
  assert.deepEqual(seen.at(-1), [1, 1], 'a finished video reads as complete');
});

test('a shot list the machine refuses comes back with the reasons', async () => {
  const { fetchImpl } = machine([
    () => json({ error: 'This recipe cannot be rendered.', problems: ['shot 2 taps nothing'] }, 400)
  ]);

  await assert.rejects(
    () => renderRemotely('bad', { fetchImpl, wait: noWait }),
    /cannot be rendered[\s\S]*shot 2 taps nothing/
  );
});

test('a render that fails on the machine says why', async () => {
  const { fetchImpl } = machine([
    () => json({ id: 'j' }, 202),
    () => json({ state: 'failed', error: 'ffmpeg was not found on PATH' })
  ]);

  await assert.rejects(
    () => renderRemotely('x', { fetchImpl, wait: noWait }),
    /ffmpeg was not found/
  );
});

test('an empty video is treated as a failure, not as a video', async () => {
  const { fetchImpl } = machine([
    () => json({ id: 'j' }, 202),
    () => json({ state: 'done', ready: true }),
    () => new Response('')
  ]);

  await assert.rejects(
    () => renderRemotely('x', { fetchImpl, wait: noWait }),
    /empty video/
  );
});

test('a studio with no render machine behind it says so', async () => {
  const { fetchImpl } = machine([() => json({ error: 'This studio has no render service' }, 501)]);
  await assert.rejects(() => renderRemotely('x', { fetchImpl, wait: noWait }), /no render service/);
});

test('a reply with no job id is an error rather than an endless poll', async () => {
  const { fetchImpl } = machine([() => json({ ok: true }, 202)]);
  await assert.rejects(() => renderRemotely('x', { fetchImpl, wait: noWait }), /which video/);
});

test('a render that never finishes gives up instead of polling forever', async () => {
  let clock = 0;
  const original = Date.now;
  Date.now = () => clock;
  try {
    const { fetchImpl } = machine([
      () => json({ id: 'j' }, 202),
      () => json({ state: 'rendering', done: 1, total: 500, place: 0 })
    ]);
    await assert.rejects(
      () => renderRemotely('x', {
        fetchImpl,
        wait: async () => { clock += GIVE_UP_MS / 4; }
      }),
      /taking longer than it should/
    );
  } finally {
    Date.now = original;
  }
});

test('the queue is reported in words a person can act on', () => {
  assert.match(describe({ state: 'queued', done: 0, place: 3 }), /3 videos ahead/);
  assert.match(describe({ state: 'queued', done: 0, place: 1 }), /Waiting for the render machine/);
  assert.match(describe({ state: 'rendering', done: 90, total: 228, place: 0 }), /frame 90 of 228/);
  /* Before the total is known there is nothing to count, and saying "frame 0
   * of 0" would read as broken. */
  assert.equal(describe({ state: 'rendering', done: 0, place: 0 }), 'Rendering…');
});

test('whether a render machine exists is asked, not assumed', async () => {
  const yes = (async () => json({ signedIn: true, canRender: true })) as unknown as typeof fetch;
  const no = (async () => json({ signedIn: true, canRender: false })) as unknown as typeof fetch;
  const broken = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;

  assert.equal(await canRenderRemotely(yes), true);
  assert.equal(await canRenderRemotely(no), false);
  /* A page that cannot reach the Worker should not claim it can render. */
  assert.equal(await canRenderRemotely(broken), false);
});
