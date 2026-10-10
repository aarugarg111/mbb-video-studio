import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createService, MAX_RECIPE_BYTES } from '../worker/service.js';

const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };

/* A compile that answers from the text itself, so each test can ask for a
 * good recipe, a broken one or a warning without writing YAML. */
const fakeCompile = text => {
  if (text.includes('BOOM')) throw new Error('bad indentation');
  if (text.includes('BROKEN')) return { errors: ['shot 1 names a screen that does not exist'], warnings: [] };
  return {
    recipe: { video: 'clip', shots: [] },
    warnings: text.includes('WARN') ? ['kit/cta/download-now.png is missing'] : []
  };
};

function service(opts = {}) {
  return createService({
    compile: fakeCompile,
    render: async () => ({ video: '/tmp/clip.mp4' }),
    ...opts
  });
}

test('a good recipe is accepted and comes back with a job to watch', async () => {
  const { handle } = service();
  const res = await handle({ method: 'POST', path: '/render', body: { recipe: 'ok' } });

  assert.equal(res.status, 202);
  assert.match(res.body.id, /^[0-9a-f]{24}/);
  assert.ok(['queued', 'rendering'].includes(res.body.state));
});

test('warnings travel with the job rather than being swallowed', async () => {
  const { handle } = service();
  const res = await handle({ method: 'POST', path: '/render', body: { recipe: 'WARN' } });
  assert.deepEqual(res.body.warnings, ['kit/cta/download-now.png is missing']);
});

test('a recipe that cannot be rendered is refused, with the reasons', async () => {
  const { handle } = service();
  const res = await handle({ method: 'POST', path: '/render', body: { recipe: 'BROKEN' } });

  assert.equal(res.status, 400);
  assert.deepEqual(res.body.problems, ['shot 1 names a screen that does not exist']);
});

test('unreadable YAML is a plain answer, not a crash', async () => {
  const { handle } = service();
  const res = await handle({ method: 'POST', path: '/render', body: { recipe: 'BOOM' } });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /bad indentation/);
});

test('an empty recipe is refused', async () => {
  const { handle } = service();
  for (const body of [{}, { recipe: '' }, { recipe: '   ' }, null]) {
    const res = await handle({ method: 'POST', path: '/render', body });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test('an enormous body is refused before anything reads it', async () => {
  const { handle } = service();
  const res = await handle({
    method: 'POST', path: '/render',
    body: { recipe: 'x'.repeat(MAX_RECIPE_BYTES + 1) }
  });
  assert.equal(res.status, 413);
});

test('a finished job hands over the file', async () => {
  const { handle } = service();
  const { body: job } = await handle({ method: 'POST', path: '/render', body: { recipe: 'ok' } });
  await settle();

  const status = await handle({ path: `/render/${job.id}` });
  assert.equal(status.body.state, 'done');
  assert.equal(status.body.ready, true);
  assert.ok(!JSON.stringify(status.body).includes('/tmp/'),
    'the status must not tell the browser where the file sits on the server');

  const video = await handle({ path: `/render/${job.id}/video` });
  assert.equal(video.status, 200);
  assert.equal(video.file, '/tmp/clip.mp4');
  assert.equal(video.type, 'video/mp4');
});

test('asking for a video that is still rendering says so instead of sending nothing', async () => {
  const { handle } = service({ render: () => new Promise(() => {}) });
  const { body: job } = await handle({ method: 'POST', path: '/render', body: { recipe: 'ok' } });
  await settle();

  const res = await handle({ path: `/render/${job.id}/video` });
  assert.equal(res.status, 409);
  assert.equal(res.body.state, 'rendering');
});

test('a render that failed reports its reason where the video would be', async () => {
  const { handle } = service({ render: () => { throw new Error('ffmpeg was not found on PATH'); } });
  const { body: job } = await handle({ method: 'POST', path: '/render', body: { recipe: 'ok' } });
  await settle();

  const status = await handle({ path: `/render/${job.id}` });
  assert.equal(status.body.state, 'failed');
  assert.match(status.body.error, /ffmpeg/);

  const video = await handle({ path: `/render/${job.id}/video` });
  assert.equal(video.status, 500);
  assert.match(video.body.error, /ffmpeg/);
});

test('an unknown job says what to do about it', async () => {
  const { handle } = service();
  const res = await handle({ path: '/render/abc123' });
  assert.equal(res.status, 404);
  assert.match(res.body.error, /render it again/);
});

test('a job id with a path in it cannot reach the disk', async () => {
  const { handle } = service();
  for (const path of ['/render/../../etc/passwd', '/render/..%2F..%2Fsecret', '/render/a/b/video']) {
    const res = await handle({ path });
    assert.equal(res.status, 404, path);
    assert.match(res.body.error, /No such endpoint|No such video/);
  }
});

test('without the token nothing renders', async () => {
  const { handle } = service({ token: 'the-shared-token' });

  const bare = await handle({ method: 'POST', path: '/render', body: { recipe: 'ok' } });
  assert.equal(bare.status, 401);

  const wrong = await handle({
    method: 'POST', path: '/render', body: { recipe: 'ok' },
    headers: { authorization: 'Bearer not-the-token' }
  });
  assert.equal(wrong.status, 401);

  const right = await handle({
    method: 'POST', path: '/render', body: { recipe: 'ok' },
    headers: { authorization: 'Bearer the-shared-token' }
  });
  assert.equal(right.status, 202);
});

test('a token with a stray newline round it still works', async () => {
  /* The same whitespace that broke the team password twice: whatever stores
   * the secret keeps what the terminal gave it. */
  const { handle } = service({ token: '  the-shared-token\n' });
  const res = await handle({
    method: 'POST', path: '/render', body: { recipe: 'ok' },
    headers: { authorization: 'Bearer the-shared-token' }
  });
  assert.equal(res.status, 202);
});

test('health needs no token, so a host can watch the service', async () => {
  const { handle } = service({ token: 'secret' });
  const res = await handle({ path: '/health' });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test('progress reaches the page as frames and a total', async () => {
  let report;
  const { handle } = service({
    render: (_recipe, { onProgress }) => { report = onProgress; return new Promise(() => {}); }
  });
  const { body: job } = await handle({ method: 'POST', path: '/render', body: { recipe: 'ok' } });
  await settle();

  report(0, 504);
  report(252);
  const status = await handle({ path: `/render/${job.id}` });
  assert.equal(status.body.done, 252);
  assert.equal(status.body.total, 504);
});

test('a second request while one renders is told where it is in the line', async () => {
  const { handle } = service({ render: () => new Promise(() => {}) });
  await handle({ method: 'POST', path: '/render', body: { recipe: 'ok' } });
  await settle();
  const second = await handle({ method: 'POST', path: '/render', body: { recipe: 'ok' } });

  assert.equal(second.body.state, 'queued');
  assert.equal(second.body.place, 1);
});

test('an endpoint nobody has is a plain 404', async () => {
  const { handle } = service();
  assert.equal((await handle({ path: '/' })).status, 404);
  assert.equal((await handle({ method: 'DELETE', path: '/render/abc' })).status, 405);
});
