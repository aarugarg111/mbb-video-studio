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
