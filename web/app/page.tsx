'use client';

import { useEffect, useRef, useState } from 'react';
import { asset } from '../lib/base-path';
import { ctaImageExists } from '../lib/assets';
import { THEMES } from '@/lib/schema';
import { proposeRecipe } from '@/lib/claude';
import { TEAM_MODE, signIn, signOut, isSignedIn } from '@/lib/team';
import { renderVideo } from '@/lib/render';
import { isSupported } from '@/lib/encode';
import { renderRemotely, canRenderRemotely } from '@/lib/render-remote';
import { Stage } from './studio/stage';
// The renderer's own validator - the same one the CLI uses.
import { parse } from '../../src/recipe.js';
import { catalogue } from '../../screens/index.js';

type Step = 'fill' | 'check' | 'rendering' | 'done';

/* The rail along the top. Rendering is not a step of its own - it is the
   second step still running - so it shares the shot list's place. */
const STEPS: [Step, string][] = [
  ['fill', 'Paste the script'],
  ['check', 'Check the shot list'],
  ['done', 'Your video']
];
const KEY_NAME = 'mbb-anthropic-key';

export default function Page() {
  const [step, setStep] = useState<Step>('fill');
  const [script, setScript] = useState('');
  const [business, setBusiness] = useState('');
  const [party, setParty] = useState('');
  const [theme, setTheme] = useState('');
  const [recipe, setRecipe] = useState('');
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [apiKey, setApiKey] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [password, setPassword] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(TEAM_MODE);
  const [supported, setSupported] = useState(true);
  /* Whether this studio has a render machine behind it. Asked rather than
     assumed, so a browser that cannot encode is told what it can do instead of
     finding out at the end of a render. */
  const [canRemote, setCanRemote] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef('');

  useEffect(() => {
    if (TEAM_MODE) {
      isSignedIn().then(setSignedIn).finally(() => setCheckingSession(false));
    } else {
      try { setApiKey(localStorage.getItem(KEY_NAME) ?? ''); } catch { /* private mode */ }
    }
    setSupported(isSupported());
    if (TEAM_MODE) canRenderRemotely().then(setCanRemote);

    /* A testing hook. renderVideo is a pure function of a recipe and this page
     * holds no secrets, so exposing it costs nothing and makes the render path
     * measurable from outside - which is how the browser output gets compared
     * against the ffmpeg one, frame by frame. */
    (window as unknown as { renderVideo?: typeof renderVideo }).renderVideo = renderVideo;
  }, []);

  function saveKey() {
    const k = keyDraft.trim();
    if (!k) return;
    try { localStorage.setItem(KEY_NAME, k); } catch { /* kept in memory only */ }
    setApiKey(k);
    setKeyDraft('');
    setEditingKey(false);
  }

  async function submitPassword() {
    setBusy(true);
    setError('');
    try {
      await signIn(password);
      setPassword('');
      setSignedIn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    await signOut();
    setSignedIn(false);
  }

  /* Clears the whole run so the next video starts from an empty form. The
   * object URL has to go with it, or every video made in this tab stays in
   * memory until the tab is closed. */
  function startOver() {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = '';
    }
    setVideoUrl('');
    setScript('');
    setBusiness('');
    setParty('');
    setTheme('');
    setRecipe('');
    setUnsupported([]);
    setWarnings([]);
    setError('');
    setProgress({ done: 0, total: 0 });
    setStep('fill');
  }

  async function propose() {
    setBusy(true);
    setError('');
    try {
      const proposed = await proposeRecipe({
        ...(TEAM_MODE ? {} : { apiKey }),
        script,
        /* Only send what was filled in - an empty field must not overwrite
         * something the script got right. */
        details: {
          ...(business ? { business: { name: business } } : {}),
          ...(party ? { party: { name: party } } : {}),
          ...(theme ? { invoice: { theme } } : {})
        }
      });
      setRecipe(proposed.recipe);
      setUnsupported(proposed.unsupported);
      setStep('check');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function render() {
    setError('');
    setWarnings([]);

    let checked: any;
    try {
      checked = parse(recipe, catalogue(), { ctaImage: await ctaImageExists() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The shot list could not be read.');
      return;
    }
    if (checked.errors) {
      setError(checked.errors.join('\n'));
      return;
    }
    setWarnings(checked.warnings ?? []);

    /* Free the previous video before making another, or repeated renders
     * hold every MP4 in memory until the tab dies. */
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = '';
      setVideoUrl('');
    }

    setBusy(true);
    setProgress({ done: 0, total: 0 });
    setStep('rendering');
    try {
      /* In the browser when the browser can, on the render machine when it
         cannot. Both make the same clip from the same shot list; the only
         difference is which machine spends the minute. */
      const onProgress = (done: number, total: number) => setProgress({ done, total });
      const blob = supported
        ? await renderVideo(checked.recipe, { onProgress })
        : await renderRemotely(recipe, { onProgress });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setVideoUrl(url);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The render failed.');
      setStep('check');
    } finally {
      setBusy(false);
    }
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const stepIndex = step === 'fill' ? 0 : step === 'done' ? 2 : 1;
  const needKey = !TEAM_MODE && (!apiKey || editingKey);
  /* The studio is unusable until Claude can be reached, whichever way that
   * is - so the script form waits behind the same gate in both modes. */
  const ready = TEAM_MODE ? signedIn : Boolean(apiKey);

  return (
    <main>
      <Stage ref={stageRef} />
      <header className="masthead">
        <img src={asset("/kit/brand/mybillbook-logo.webp")} alt="myBillBook" />
        <h1>Video Studio</h1>
        {TEAM_MODE && signedIn && (
          <button className="linkbtn" onClick={leave}>Sign out</button>
        )}
      </header>
      <p className="sub">Paste a creator script. Everything else — the shop, the customer, the items, the theme — is read out of it.</p>

      {!supported && canRemote && (
        <div className="note">
          This browser cannot make video itself, so the studio will make it for you on the render machine. It takes a minute or two longer.
        </div>
      )}

      {!supported && !canRemote && (
        <div className="note error">
          This browser cannot make the video. Use Chrome or Edge on a computer — Safari cannot encode H.264 video, so a render would fail at the end.
        </div>
      )}

      {TEAM_MODE && !signedIn && !checkingSession && (
        <div className="keybox">
          <p>Sign in with the team password to use the studio.</p>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter' && password.trim() && !busy) submitPassword(); }}
                 placeholder="Team password" aria-label="Team password" />
          <button onClick={submitPassword} disabled={busy || !password.trim()}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      )}


      {needKey && (
        <div className="keybox">
          <p>
            Paste your Anthropic API key. It stays in this browser and is sent only to Anthropic.
            Get one at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a>.
          </p>
          <input type="password" value={keyDraft} onChange={e => setKeyDraft(e.target.value)}
                 placeholder="sk-ant-..." aria-label="Anthropic API key" />
          <button onClick={saveKey} disabled={!keyDraft.trim()}>Save key</button>
        </div>
      )}
      {!TEAM_MODE && !needKey && (
        <p className="sub">
          Key saved in this browser. <a href="#" onClick={e => { e.preventDefault(); setEditingKey(true); }}>Change key</a>
        </p>
      )}

      {ready && (
        <ol className="steps" aria-label="Progress">
          {STEPS.map(([key, label], i) => (
            <li key={key} className={stepIndex === i ? 'now' : stepIndex > i ? 'past' : ''}>
              <span className="dot">{stepIndex > i ? '✓' : i + 1}</span>{label}
            </li>
          ))}
        </ol>
      )}

      {ready && step === 'fill' && (
        <>
          <label htmlFor="script">Paste the script</label>
          <textarea id="script" value={script} onChange={e => setScript(e.target.value)}
                    placeholder="Paste the finalized script, including its [Internal team adds: UI — ...] markers." />
          <p className="hint">The shop, the customer, the items and the theme are all read out of the script. Only fill in an override below if the script gets one of them wrong.</p>

          <details className="overrides">
            <summary>Overrides — only if the script gets something wrong</summary>
            <div className="row">
              <div>
                <label htmlFor="business">Shop name</label>
                <input id="business" value={business} onChange={e => setBusiness(e.target.value)}
                       placeholder="taken from the script" />
              </div>
              <div>
                <label htmlFor="party">Customer name</label>
                <input id="party" value={party} onChange={e => setParty(e.target.value)}
                       placeholder="taken from the script" />
              </div>
            </div>
            <label htmlFor="theme">Theme</label>
            <select id="theme" value={theme} onChange={e => setTheme(e.target.value)}>
              <option value="">Let the script decide</option>
              {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </details>

          <button onClick={propose} disabled={busy || !script.trim() || !ready}>
            {busy ? 'Reading the script…' : 'Read the script'}
          </button>
        </>
      )}

      {step === 'check' && (
        <>
          {unsupported.length > 0 && (
            <div className="note warn">
              <strong>Not in this video —</strong> the script asks for these and there are no screens for them yet:
              {unsupported.map((u, i) => <div key={i}>· {u}</div>)}
            </div>
          )}
          <label htmlFor="recipe">The shot list — change anything that looks wrong</label>
          <textarea id="recipe" className="recipe" value={recipe}
                    onChange={e => setRecipe(e.target.value)} />

          <div className="row">
            <button onClick={render} disabled={busy || (!supported && !canRemote)}>Render the video</button>
            <button className="secondary" onClick={() => setStep('fill')} disabled={busy}>
              Back
            </button>
          </div>
        </>
      )}

      {step === 'rendering' && (
        <>
          <p className="rendering">
            {progress.total
              ? `Making your video — frame ${progress.done} of ${progress.total}.`
              : 'Getting ready…'}
          </p>
          <div className="bar"><div style={{ width: `${pct}%` }} /></div>
          <p className="hint">This happens on your own computer, so keep this tab open and in front until it finishes.</p>
        </>
      )}

      {step === 'done' && (
        <>
          <div className="note good">Your video is ready. Play it below, then download it.</div>
          <video src={videoUrl} controls />
          <div className="actions">
            <a className="btnlink" href={videoUrl} download="video.mp4">
              <button>Download the video</button>
            </a>
            <button className="secondary" onClick={() => setStep('check')}>
              Change the shot list
            </button>
            <button className="secondary" onClick={startOver}>
              Make another video
            </button>
          </div>
        </>
      )}

      {warnings.length > 0 && (
        <div className="note warn">
          {warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}

      {error && <div className="note error">{error}</div>}
    </main>
  );
}
