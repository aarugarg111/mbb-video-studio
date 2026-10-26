import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { compile } from '../worker/compile.js';
import { ASPECTS, withAspect, aspectNamed, DEFAULT_ASPECT } from '../src/aspect.js';

/* Does the picture actually fit, and is it actually in the middle?
 *
 * Three shapes means three compositions, and a frame composed for the wrong
 * one is still a frame: it renders, it encodes, it plays. The only way to
 * know is to measure where things landed, which is what this does - in a
 * real browser, through the real stage, at a real moment of a real recipe.
 *
 * What it does NOT demand is that a laptop window sit dead centre in a Reel.
 * There the window is deliberately wider than the picture and the screen
 * names the part of the page the clip is about, so the camera is off-centre
 * on purpose. The rule is: whatever fits inside the picture is centred in
 * it, and nothing is ever cut off at the top or the bottom.
 */

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'
};

function serve() {
  const server = createServer(async (req, res) => {
    const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^[/\\]+/, '');
    try {
      const body = await readFile(join(ROOT, rel));
      res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end('not found'); }
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

/* Where the device box landed, in the finished picture. */
async function measure(page, origin, recipe, shape, at, selector) {
  const aspect = ASPECTS[shape];
  await page.setViewportSize({ width: aspect.width, height: aspect.height });
  await page.goto(`${origin}/stage/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.setTime === 'function', null, { timeout: 15000 });
  await page.evaluate(r => window.mount(r), { ...recipe, aspect: shape });
  await page.evaluate(() => window.stageReady);
  await page.evaluate(t => window.setTime(t), at);
  return page.evaluate(s => {
    const b = document.querySelector(s).getBoundingClientRect();
    const area = document.getElementById('stage-area').getBoundingClientRect();
    return {
      left: b.left, right: b.right, top: b.top, bottom: b.bottom,
      areaTop: area.top, areaBottom: area.bottom
    };
  }, selector);
}

test('every shape fits the picture, and sits in the middle of it', async (t) => {
  t.diagnostic('this launches a browser and draws every shape');

  const { server, origin } = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });

    const cases = [
      ['a phone', 'recipes/momos-day.yaml', 2.0, '#phone'],
      ['a laptop', 'recipes/desktop-billing.yaml', 1.0, '#desktop']
    ];

    for (const [what, file, at, selector] of cases) {
      const { recipe, errors } = await compile(await readFile(join(ROOT, file), 'utf8'));
      assert.equal(errors, undefined, `${file} does not compile`);

      for (const [shape, aspect] of Object.entries(ASPECTS)) {
        const m = await measure(page, origin, recipe, shape, at, selector);
        const where = `${what} in ${shape}`;

        /* Nothing is cut off above or below. There is no "out of frame" that
           reads as deliberate at the bottom of a window - it just looks like
           the render went wrong. */
        assert.ok(m.top >= m.areaTop - 1,
          `${where} starts ${(m.areaTop - m.top).toFixed(0)}px above the picture`);
        assert.ok(m.bottom <= m.areaBottom + 1,
          `${where} hangs ${(m.bottom - m.areaBottom).toFixed(0)}px below the picture`);

        /* And it is centred between the top and the bottom. */
        const topGap = m.top - m.areaTop;
        const bottomGap = m.areaBottom - m.bottom;
        assert.ok(Math.abs(topGap - bottomGap) < 2,
          `${where} sits ${(topGap - bottomGap).toFixed(0)}px off centre vertically`);

        /* Across, only when it fits. A laptop window in a Reel is wider than
           the picture on purpose and the camera is pointed at the part of the
           page the clip is about, so there is nothing to centre. */
        const fitsAcross = m.left >= -1 && m.right <= aspect.width + 1;
        if (fitsAcross) {
          assert.ok(Math.abs(m.left - (aspect.width - m.right)) < 2,
            `${where} sits ${(m.left - (aspect.width - m.right)).toFixed(0)}px off centre across`);
        } else {
          /* If it does not fit, it must at least cover the whole width -
             a gap down one side with the other side cropped is the worst of
             both and means the scale is wrong. */
          assert.ok(m.left <= 1 && m.right >= aspect.width - 1,
            `${where} is cropped on one side and short on the other`);
        }

        /* A phone must never be cut off across either: a phone with its
           edges missing is not a phone, it is a mistake. */
        if (what === 'a phone') {
          assert.ok(fitsAcross, `${where} has its edges cut off`);
        }
      }
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('a shape stamped onto a shot list is the shape that renders', () => {
  /* The render machine is handed YAML, not a recipe, so when the studio cuts
     all three it says which shape each one is in the text. A stamp that
     missed would send three identical Reels back and nothing would say so. */
  const text = 'video: t\nbusiness:\n  name: X\nshots: []\n';
  for (const shape of Object.keys(ASPECTS)) {
    const stamped = withAspect(text, shape);
    assert.match(stamped, new RegExp(`^aspect: "${shape}"`), `${shape} was not stamped`);
    assert.ok(stamped.includes('video: t'), 'the rest of the shot list was lost');
  }

  /* An existing shape is replaced, not added beside - two top-level keys of
     the same name is a YAML error, and the clip would not render at all. */
  const already = withAspect('aspect: "16:9"\nvideo: t\n', '1:1');
  assert.equal((already.match(/^aspect:/gm) ?? []).length, 1, 'two aspect keys');
  assert.match(already, /^aspect: "1:1"/);

  /* A nested "aspect" belongs to something else and is left alone. */
  const nested = withAspect('video: t\nbrand:\n  aspect: whatever\n', 'square');
  assert.ok(nested.includes('  aspect: whatever'), 'a nested key was eaten');

  /* And a name a person would write still works through the stamp. */
  assert.match(withAspect('video: t\n', 'horizontal'), /^aspect: "16:9"/);
  assert.match(withAspect('video: t\n', 'nonsense'), new RegExp(`^aspect: "${DEFAULT_ASPECT}"`),
    'an unrecognised shape falls back rather than writing something unrenderable');
  assert.equal(aspectNamed('all'), null, '"all" is the studio\'s word, not a shape');
});
