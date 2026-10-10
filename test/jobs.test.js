import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue } from '../worker/jobs.js';

/* A render we can hold at any point, so the queue's behaviour mid-render is
 * observable without opening a browser. */
function gate() {
  let open;
  const promise = new Promise(resolve => { open = resolve; });
  return { promise, open };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('a submitted job starts rendering', async () => {
  const held = gate();
  const q = createQueue({ run: () => held.promise });

  /* Nothing is in front of it, so it is already rendering by the time submit
   * returns - the reply says what is true rather than always saying queued. */
  const job = q.submit({ recipe: {}, name: 'one' });
  assert.equal(job.state, 'rendering');

  held.open({ video: '/tmp/one.mp4' });
  await settle();
  await settle();

  const done = q.status(job.id);
  assert.equal(done.state, 'done');
  assert.equal(done.ready, true);
  /* The file is reachable to the one caller that serves it, and to nobody
   * who only asked how the render was going. */
  assert.equal(q.find(job.id).video, '/tmp/one.mp4');
  assert.ok(!JSON.stringify(done).includes('/tmp/'), 'a status reply must not carry a server path');
});

test('only one render runs at a time, and the rest are told where they are', async () => {
  /* A gate each: one shared gate would release every render at once and the
   * queue would look like it ran them in parallel. */
  const gates = { a: gate(), b: gate(), c: gate() };
  let started = 0;
  const q = createQueue({ run: job => { started += 1; return gates[job.name].promise; } });

  const a = q.submit({ recipe: {}, name: 'a' });
  const b = q.submit({ recipe: {}, name: 'b' });
  const c = q.submit({ recipe: {}, name: 'c' });

  await settle();
  assert.equal(started, 1, 'the second render must not start while the first is running');
  assert.equal(q.status(a.id).state, 'rendering');
  assert.equal(q.status(a.id).place, 0);
  assert.equal(q.status(b.id).place, 1);
  assert.equal(q.status(c.id).place, 2);

  gates.a.open({ video: 'x' });
  await settle();
  await settle();
  assert.equal(started, 2, 'the next render starts once the first finishes');
  assert.equal(q.status(b.id).state, 'rendering');
  assert.equal(q.status(c.id).place, 1, 'and everyone behind moves up the line');
  gates.b.open({ video: 'x' });
  gates.c.open({ video: 'x' });
});

test('one render failing does not stop the next', async () => {
  const runs = [];
  const q = createQueue({
    run: job => {
      runs.push(job.name);
      if (job.name === 'bad') throw new Error('ffmpeg fell over');
      return { video: 'ok.mp4' };
    }
  });

  const bad = q.submit({ recipe: {}, name: 'bad' });
  const good = q.submit({ recipe: {}, name: 'good' });

  for (let i = 0; i < 6; i++) await settle();

  assert.equal(q.status(bad.id).state, 'failed');
  assert.equal(q.status(bad.id).error, 'ffmpeg fell over');
  assert.equal(q.status(good.id).state, 'done');
  assert.deepEqual(runs, ['bad', 'good']);
});

test('progress is reported as frames rendered out of the total', async () => {
  const held = gate();
  let report;
  const q = createQueue({ run: (job, onProgress) => { report = onProgress; return held.promise; } });

  const job = q.submit({ recipe: {}, name: 'p' });
  await settle();

  report(0, 504);
  assert.equal(q.status(job.id).total, 504);
  report(120);
  assert.equal(q.status(job.id).done, 120);
  assert.equal(q.status(job.id).total, 504, 'the total is not forgotten between reports');

  held.open({ video: 'p.mp4' });
  await settle();
  await settle();
  assert.equal(q.status(job.id).done, 504, 'a finished render reads as complete, not 120 of 504');
});

test('a queue that is already too long refuses rather than growing', async () => {
  const held = gate();
  const q = createQueue({ run: () => held.promise, maxWaiting: 2 });

  q.submit({ recipe: {}, name: 'rendering' });
  await settle();
  q.submit({ recipe: {}, name: 'waiting 1' });
  q.submit({ recipe: {}, name: 'waiting 2' });

  assert.throws(() => q.submit({ recipe: {}, name: 'too many' }), /already waiting/);
  held.open({ video: 'x' });
});

test('an unknown job id reads as nothing, not as an error', () => {
  const q = createQueue({ run: () => ({}) });
  assert.equal(q.status('nope'), null);
  assert.equal(q.find('nope'), null);
});

test('job ids are not guessable from each other', () => {
  const q = createQueue({ run: () => new Promise(() => {}), maxWaiting: 100 });
  const ids = new Set();
  for (let i = 0; i < 50; i++) ids.add(q.submit({ recipe: {}, name: String(i) }).id);
  assert.equal(ids.size, 50, 'every job gets its own id');
  for (const id of ids) assert.match(id, /^[0-9a-f]{24}[0-9a-z]+$/);
});

test('a finished video is cleaned up once its hour is out', async () => {
  let clock = 0;
  const cleaned = [];
  const q = createQueue({
    run: () => ({ video: 'gone.mp4' }),
    now: () => clock,
    keepMs: 1000
  });

  const job = q.submit({ recipe: {}, name: 'old', cleanup: j => cleaned.push(j.name) });
  for (let i = 0; i < 4; i++) await settle();
  assert.equal(q.status(job.id).state, 'done');

  clock = 2000;
  /* The sweep runs when the queue is next touched, which is the only moment
   * it matters - there is no timer to keep the process awake. */
  q.submit({ recipe: {}, name: 'new' });
  for (let i = 0; i < 4; i++) await settle();

  assert.equal(q.status(job.id), null, 'the expired job is forgotten');
  assert.deepEqual(cleaned, ['old'], 'and its file is deleted');
});

test('a render still in progress is never swept away', async () => {
  let clock = 0;
  const held = gate();
  const q = createQueue({ run: () => held.promise, now: () => clock, keepMs: 10 });

  const job = q.submit({ recipe: {}, name: 'slow' });
  await settle();
  clock = 100000;
  q.submit({ recipe: {}, name: 'next' });
  await settle();

  assert.equal(q.status(job.id).state, 'rendering');
  held.open({ video: 'x' });
});
