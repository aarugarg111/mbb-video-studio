'use client';

import { useState } from 'react';
import { THEMES } from '@/lib/schema';

type Stage = 'fill' | 'check' | 'rendering' | 'done';

export default function Page() {
  const [stage, setStage] = useState<Stage>('fill');
  const [script, setScript] = useState('');
  const [business, setBusiness] = useState('');
  const [party, setParty] = useState('');
  const [theme, setTheme] = useState('');
  const [recipe, setRecipe] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [busy, setBusy] = useState(false);

  async function propose() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        /* Only send what was actually filled in - an empty field must not
         * overwrite something the script got right. */
        body: JSON.stringify({
          script,
          details: {
            ...(business ? { business: { name: business } } : {}),
            ...(party ? { party: { name: party } } : {}),
            ...(theme ? { invoice: { theme } } : {})
          }
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not read that script.');
      setRecipe(body.recipe);
      setStage('check');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function render() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe })
      });
      const body = await res.json();
      if (!res.ok) {
        setError((body.errors ?? [body.error ?? 'Could not start the render.']).join('\n'));
        return;
      }

      setWarnings(body.warnings ?? []);
      setStage('rendering');
      await poll(body.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStage('check');
    } finally {
      setBusy(false);
    }
  }

  async function poll(id: string) {
    /* A run takes about two and a half minutes including the runner starting
     * up. Three seconds between checks is responsive without hammering the
     * GitHub API, whose rate limit is shared across everyone using this. */
    for (;;) {
      await new Promise(r => setTimeout(r, 3000));
      const res = await fetch(`/api/render/${id}`);
      const body = await res.json();

      if (body.status === 'done') {
        setVideoUrl(`/api/render/${id}/file`);
        setStage('done');
        return;
      }
      if (body.status === 'failed') {
        setError(body.error ?? 'The render failed.');
        setStage('check');
        return;
      }
    }
  }

  return (
    <main>
      <h1>myBillBook Video Studio</h1>
      <p className="sub">Paste a creator script. Everything else — the shop, the customer, the items, the theme — is read out of it.</p>

      {stage === 'fill' && (
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

          <button onClick={propose} disabled={busy || !script.trim()}>
            {busy ? 'Reading the script…' : 'Propose a shot list'}
          </button>
        </>
      )}

      {stage === 'check' && (
        <>
          <label htmlFor="recipe">The shot list — change anything that looks wrong</label>
          <textarea id="recipe" className="recipe" value={recipe}
                    onChange={e => setRecipe(e.target.value)} />

          <div className="row">
            <button onClick={render} disabled={busy}>Render the video</button>
            <button className="secondary" onClick={() => setStage('fill')} disabled={busy}>
              Back
            </button>
          </div>
        </>
      )}

      {stage === 'rendering' && (
        <p className="note warn">Rendering on a GitHub runner. This takes about two to three minutes.</p>
      )}

      {stage === 'done' && (
        <>
          <p className="note warn">Done.</p>
          <video src={videoUrl} controls />
          <a href={videoUrl} download>
            <button>Download the MP4</button>
          </a>
          <button className="secondary" onClick={() => setStage('check')}>
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
