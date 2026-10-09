'use client';

import { useEffect, useRef, useState } from 'react';
import { asset } from '../lib/base-path';
import { THEMES } from '@/lib/schema';
import { proposeRecipe } from '@/lib/claude';
import { renderVideo } from '@/lib/render';
import { isSupported } from '@/lib/encode';
import { Stage } from './studio/stage';
// The renderer's own validator - the same one the CLI uses.
import { parse } from '../../src/recipe.js';
import { catalogue } from '../../screens/index.js';

type Step = 'fill' | 'check' | 'rendering' | 'done';
const KEY_NAME = 'mbb-anthropic-key';

export default function Page() {
  const [step, setStep] = useState<Step>('fill');
  const [script, setScript] = useState('');
  const [business, setBusiness] = useState('');
  const [party, setParty] = useState('');
  const [theme, setTheme] = useState('');
  const [recipe, setRecipe] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [apiKey, setApiKey] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [supported, setSupported] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef('');

  useEffect(() => {
    try { setApiKey(localStorage.getItem(KEY_NAME) ?? ''); } catch { /* private mode */ }
    setSupported(isSupported());

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

  async function propose() {
    setBusy(true);
    setError('');
    try {
      const text = await proposeRecipe({
        apiKey,
        script,
        /* Only send what was filled in - an empty field must not overwrite
         * something the script got right. */
        details: {
          ...(business ? { business: { name: business } } : {}),
          ...(party ? { party: { name: party } } : {}),
          ...(theme ? { invoice: { theme } } : {})
        }
      });
      setRecipe(text);
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
      checked = parse(recipe, catalogue());
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
      const blob = await renderVideo(checked.recipe, {
        onProgress: (done, total) => setProgress({ done, total })
      });
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
  const needKey = !apiKey || editingKey;

  return (
    <main>
      <Stage ref={stageRef} />
      <header className="masthead">
        <img src={asset("/kit/brand/mybillbook-logo.webp")} alt="myBillBook" />
        <h1>Video Studio</h1>
      </header>
      <p className="sub">Paste a creator script. Everything else — the shop, the customer, the items, the theme — is read out of it.</p>

      {!supported && (
        <div className="note error">
          This browser cannot make the video. Use Chrome or Edge on a computer — Safari cannot encode H.264 video, so a render would fail at the end.
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
      {!needKey && (
        <p className="sub">
          Key saved in this browser. <a href="#" onClick={e => { e.preventDefault(); setEditingKey(true); }}>Change key</a>
        </p>
      )}

      {step === 'fill' && (
        <>
          <label htmlFor="script">The script</label>
          <textarea id="script" value={script} onChange={e => setScript(e.target.value)}
                    placeholder="Paste the finalized script, including its [Internal team adds: UI — ...] markers." />

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

          <button onClick={propose} disabled={busy || !script.trim() || !apiKey}>
            {busy ? 'Reading the script…' : 'Propose a shot list'}
          </button>
        </>
      )}

      {step === 'check' && (
        <>
          <label htmlFor="recipe">The shot list — change anything that looks wrong</label>
          <textarea id="recipe" className="recipe" value={recipe}
                    onChange={e => setRecipe(e.target.value)} />

          <div className="row">
            <button onClick={render} disabled={busy || !supported}>Render the video</button>
            <button className="secondary" onClick={() => setStep('fill')} disabled={busy}>
              Back
            </button>
          </div>
        </>
      )}

      {step === 'rendering' && (
        <>
          <p className="note warn">
            {progress.total
              ? `Rendering frame ${progress.done} of ${progress.total}. Keep this tab open.`
              : 'Getting ready. Keep this tab open.'}
          </p>
          <div className="bar"><div style={{ width: `${pct}%` }} /></div>
        </>
      )}

      {step === 'done' && (
        <>
          <p className="note warn">Done.</p>
          <video src={videoUrl} controls />
          <a href={videoUrl} download="video.mp4">
            <button>Download the MP4</button>
          </a>
          <button className="secondary" onClick={() => setStep('check')}>
            Change the shot list
          </button>
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
