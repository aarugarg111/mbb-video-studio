import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareHtml, escapeStyleText } from './rasterise';

const LOGO = 'data:image/png;base64,ZZZ';

test('every inline svg gets the svg namespace', () => {
  const out = prepareHtml('<div><svg width="24"><path d="M0 0"/></svg></div>', LOGO);
  assert.match(out, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="24"/);
});

test('an svg that already declares a namespace is left alone', () => {
  const src = '<svg xmlns="http://www.w3.org/2000/svg" width="8"></svg>';
  const out = prepareHtml(src, LOGO);
  assert.equal((out.match(/xmlns=/g) ?? []).length, 1, 'must not be declared twice');
});

test('several icons all get the namespace', () => {
  const out = prepareHtml('<svg></svg><i></i><svg></svg><svg></svg>', LOGO);
  assert.equal((out.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g) ?? []).length, 3);
});

test('void elements are closed for the xml parser', () => {
  const out = prepareHtml('<div><img src="/kit/brand/mybillbook-logo-reverse.png"><br></div>', LOGO);
  assert.doesNotMatch(out, /<img[^/]*[^/]>/, 'an unclosed img breaks the whole frame');
  assert.match(out, /<br\s*\/>/);
});

test('an already-closed void element is not doubly closed', () => {
  const out = prepareHtml('<br/>', LOGO);
  assert.doesNotMatch(out, /\/\/>/);
});

test('the logo path becomes the embedded data uri', () => {
  const out = prepareHtml('<img src="/kit/brand/mybillbook-logo-reverse.png"/>', LOGO);
  assert.match(out, /src="data:image\/png;base64,ZZZ"/);
  assert.doesNotMatch(out, /\.png/, 'a surviving path would silently not load');
});

test('the cta artwork path becomes the embedded data uri', () => {
  const out = prepareHtml('<img src="/kit/cta/download-now.png"/>', LOGO, 'data:image/png;base64,CTA');
  assert.ok(out.includes('data:image/png;base64,CTA'));
  assert.ok(!out.includes('download-now.png'));
});

test('a literal < in the stylesheet is escaped', () => {
  /* A CSS comment naming a file pattern - kit/themes/<slug>.png - made every
   * browser frame fail to decode while the CLI path rendered fine. */
  const out = escapeStyleText('/* kit/themes/<slug>.png */ .a { color: red }');
  assert.ok(!out.includes('<'), 'a surviving < makes the whole frame undecodable');
  assert.ok(out.includes('&lt;slug&gt;') || out.includes('&lt;slug>'));
});

test('a literal & in the stylesheet is escaped, and only once', () => {
  const out = escapeStyleText('/* salt & pepper */');
  assert.equal(out, '/* salt &amp; pepper */');
});

test('ordinary css survives escaping unchanged', () => {
  const css = '.a > .b { width: calc(100% - 4px); content: "x" }';
  assert.equal(escapeStyleText(css), css);
});

test('a non-breaking space cannot take the whole frame down', () => {
  /* The real failure behind "the source image cannot be decoded": outerHTML
     re-escapes U+00A0 as &nbsp; whatever the source wrote, and &nbsp; is not
     one of XML's five entity names. One of them anywhere makes every frame
     unparseable, and nothing says which character or which screen. */
  const out = prepareHtml('<div>21 bills&nbsp;scanned</div>', 'data:logo');
  assert.ok(!out.includes('&nbsp;'));
  assert.ok(out.includes('&#160;'));
});

test('the five XML entity names are left exactly as they are', () => {
  const out = prepareHtml('<div>Tea &amp; Co &lt;b&gt; &quot;x&quot; &apos;y&apos;</div>', 'data:logo');
  assert.ok(out.includes('&amp;'));
  assert.ok(out.includes('&lt;'));
  assert.ok(out.includes('&gt;'));
  assert.ok(out.includes('&quot;'));
  assert.ok(out.includes('&apos;'));
});

test('the typographic entities a screen might write become numeric', () => {
  const out = prepareHtml('<div>Friendly &middot; Daily &rsaquo; Party&rsquo;s</div>', 'data:logo');
  assert.ok(out.includes('&#183;'));
  assert.ok(out.includes('&#8250;'));
  assert.ok(out.includes('&#8217;'));
  assert.equal(out.match(/&[a-zA-Z][a-zA-Z0-9]*;/g), null, 'no named entity may survive');
});

test('an entity nobody anticipated is dropped rather than left to break it', () => {
  /* A missing character beats a missing video. */
  const out = prepareHtml('<div>a&thinsp;b</div>', 'data:logo');
  assert.ok(!out.includes('&thinsp;'));
  assert.ok(out.includes('<div>ab</div>'));
});
