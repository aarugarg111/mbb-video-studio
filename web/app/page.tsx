'use client';

import { useEffect, useRef, useState } from 'react';
import { asset } from '../lib/base-path';
import { ctaImageExists } from '../lib/assets';
import { THEMES } from '@/lib/schema';
import { proposeRecipe } from '@/lib/claude';
import { TEAM_MODE, signIn, signOut, isSignedIn } from '@/lib/team';
import { renderVideo } from '@/lib/render';
import { canEncode } from '@/lib/encode';
import { renderRemotely, canRenderRemotely } from '@/lib/render-remote';
import { briefingFor } from '@/lib/briefing';
import { askProvider, providerById, providerOfKey, PROVIDERS, type ProviderId } from '../lib/providers';
import { runSelfTest, asReport, type Step as CheckStep } from '@/lib/selftest';
import { Stage } from './studio/stage';
import { ShotListForm } from './studio/shot-list';
// The renderer's own validator - the same one the CLI uses.
import { parse } from '../../src/recipe.js';
import { catalogue, scrollables, zoomCatalogue } from '../../screens/index.js';

type Step = 'fill' | 'check' | 'rendering' | 'done';

/* The rail along the top. Rendering is not a step of its own - it is the
   second step still running - so it shares the shot list's place. */
const STEPS: [Step, string][] = [
  ['fill', 'Paste the script'],
  ['check', 'Check the shot list'],
  ['done', 'Your video']
];
const KEY_NAME = 'mbb-anthropic-key';
/* Which AI the pasted key belongs to. Remembered beside the key, because the
 * two only make sense together. */
const PROVIDER_NAME = 'mbb-ai-provider';

export default function Page() {
  const [step, setStep] = useState<Step>('fill');
  const [script, setScript] = useState('');
  const [business, setBusiness] = useState('');
  const [party, setParty] = useState('');
  const [theme, setTheme] = useState('');
  /* Which shape the clip is filmed in. Empty means the script decides, which
     is right for most of them - a counter scene is a phone, a desk scene is a
     laptop, and the script usually says which. */
  const [shape, setShape] = useState('');
  const [recipe, setRecipe] = useState('');
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const [error, setError] = useState('');
  /* The raw text behind a translated error, folded away. The person who sees
     it is rarely the person who can fix it, so it has to be copyable. */
  const [errorDetail, setErrorDetail] = useState('');
  const [copiedError, setCopiedError] = useState(false);
  /* The connection check, for the machines where the studio does not work. */
  const [checks, setChecks] = useState<CheckStep[] | null>(null);
  const [checking, setChecking] = useState(false);
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
  /* "Copied" on the button, briefly. Nothing else depends on it. */
  const [copied, setCopied] = useState(false);
  /* Only set when the browser refuses clipboard access, so the text can be
     shown for copying by hand instead. */
  const [fallbackBriefing, setFallbackBriefing] = useState('');
  /* Set when the shot list came from somewhere other than the studio's own
     Claude call, so the check step can explain what to do with an empty box. */
  const [byHand, setByHand] = useState(false);
  /* The shot list as a form rather than as text. Off by default: the studio
   * writes a shot list and renders it, and most clips never need this. */
  const [asForm, setAsForm] = useState(false);
  /* Whose AI reads the script. The studio's own path asks Claude against a
   * schema; the others are sent the same briefing a person would paste into a
   * chat window, and answer with YAML. Both end at the same validator. */
  const [provider, setProvider] = useState<ProviderId>('anthropic');
  const stageRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef('');

  useEffect(() => {
    if (TEAM_MODE) {
      isSignedIn().then(setSignedIn).finally(() => setCheckingSession(false));
    } else {
      try {
        setApiKey(localStorage.getItem(KEY_NAME) ?? '');
        const saved = localStorage.getItem(PROVIDER_NAME);
        if (saved) setProvider(saved as ProviderId);
      } catch { /* private mode */ }
    }
    /* Asked, not assumed. Safari has VideoEncoder and VideoFrame and fails
       anyway, so the old check promised a render it could not deliver and the
       failure landed deep inside the muxer. The stage is 1080x1920 at 30fps,
       which is exactly what the render will ask for. */
    canEncode({ width: 1080, height: 1920, fps: 30 }).then(setSupported);
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
    try {
      localStorage.setItem(KEY_NAME, k);
      /* A pasted key says which AI it belongs to, so nobody has to be asked. */
      const its = providerOfKey(k);
      if (its) { setProvider(its); localStorage.setItem(PROVIDER_NAME, its); }
      else localStorage.setItem(PROVIDER_NAME, provider);
    } catch { /* kept in memory only */ }
    setApiKey(k);
    setKeyDraft('');
    setEditingKey(false);
  }

  async function submitPassword() {
    setBusy(true);
    setError('');
    setErrorDetail('');
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
    setShape('');
    setRecipe('');
    setUnsupported([]);
    setWarnings([]);
    setError('');
    setErrorDetail('');
    setByHand(false);
    setProgress({ done: 0, total: 0 });
    setStep('fill');
  }

  /* The free path. The studio's own Claude call costs a few rupees a video;
     this costs nothing and needs no key, at the price of three copy-pastes.
     The shot list that comes back is checked by exactly the same validator,
     so a weaker model means a clearer error, not a worse video. */
  /* An error here is nearly always on its way to somebody else, so it leaves
     with everything needed to act on it - what was shown, what was said, and
     when - rather than as a photograph of half of it. */
  /* Walks the chain one hop at a time and says which hop broke. The studio
     works for most people and fails for a few, which means the fault is on one
     person's own path to it - and from the outside every one of those looks
     the same. */
  async function check() {
    setChecking(true);
    setChecks(null);
    try {
      setChecks(await runSelfTest());
    } finally {
      setChecking(false);
    }
  }

  async function copyChecks() {
    if (!checks) return;
    try {
      await navigator.clipboard.writeText(asReport(checks));
      setCopiedError(true);
      setTimeout(() => setCopiedError(false), 2500);
    } catch { /* it is on screen either way */ }
  }

  async function copyError() {
    const text = [
      'myBillBook Video Studio - error report',
      new Date().toISOString(),
      '',
      error,
      '',
      errorDetail
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedError(true);
      setTimeout(() => setCopiedError(false), 2500);
    } catch {
      /* Refused clipboard access: the text is on screen anyway, which is the
         whole reason it is no longer hidden behind a disclosure triangle. */
    }
  }

  async function copyBriefing() {
    const briefing = briefingFor(script, { business, party, theme, shape });
    try {
      await navigator.clipboard.writeText(briefing);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* Clipboard access can be refused outright, and a button that silently
         does nothing is worse than one that explains itself. */
      setError('This browser would not let the page copy. Select the instructions below and copy them by hand.');
      setFallbackBriefing(briefing);
    }
  }

  function writeItMyself() {
    setByHand(true);
    setUnsupported([]);
    setWarnings([]);
    setError('');
    setErrorDetail('');
    setStep('check');
  }

  async function propose() {
    setBusy(true);
    setError('');
    setErrorDetail('');
    try {
      /* Only send what was filled in - an empty field must not overwrite
       * something the script got right. */
      const details = {
        ...(business ? { business: { name: business } } : {}),
        ...(party ? { party: { name: party } } : {}),
        ...(theme ? { invoice: { theme } } : {}),
        ...(shape ? { shape } : {})
      };

      const proposed = onOwnKey
        ? await askProvider({
            id: provider,
            key: apiKey,
            model: providerById(provider).defaultModel,
            /* The same briefing the studio hands to somebody pasting into a
             * chat window. One set of instructions, whoever reads them. */
            prompt: briefingFor(script, { business, party, theme, shape })
          })
        : await proposeRecipe({ ...(TEAM_MODE ? {} : { apiKey }), script, details });
      setRecipe(proposed.recipe);
      setUnsupported(proposed.unsupported);
      setStep('check');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setErrorDetail((e as { detail?: string })?.detail ?? '');
    } finally {
      setBusy(false);
    }
  }

  async function render() {
    setError('');
    setErrorDetail('');
    setWarnings([]);

    let checked: any;
    try {
      checked = parse(recipe, catalogue(), {
        scrollable: scrollables(),
        zoomable: zoomCatalogue(),
        ctaImage: await ctaImageExists()
      });
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
  /* The studio's own path asks Claude on the team's key. A viewer who has
   * picked another AI and saved a key is read by that instead - which is the
   * whole point of offering them, since Gemini and Grok have free tiers and
   * the team key does not. */
  const onOwnKey = provider !== 'anthropic' && apiKey.trim().length > 0;
  /* Whether the studio can read a script ITSELF. The form no longer waits
   * behind this: without a key there is still the free path, where another AI
   * writes the shot list and the studio only renders it. */
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
          <p>Sign in with the team password to have the studio read your scripts. You can skip this and still make videos — see &ldquo;use another AI&rdquo; below.</p>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter' && password.trim() && !busy) submitPassword(); }}
                 placeholder="Team password" aria-label="Team password" />
          <button onClick={submitPassword} disabled={busy || !password.trim()}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      )}


      {TEAM_MODE && signedIn && (
        <details className="overrides own-key" open={onOwnKey}>
          <summary>
            {onOwnKey
              ? `Reading your scripts with your own ${providerById(provider).name} key`
              : 'Use your own AI key instead — free'}
          </summary>
          <p className="whose-note">
            The studio reads scripts on the team&rsquo;s key, which costs the team money.
            Gemini and Grok have free tiers, so you can use your own instead. It stays in
            this browser and is sent only to the AI you pick.
          </p>
          <div className="whose" role="group" aria-label="Whose AI reads the script">
            {PROVIDERS.map(p => (
              <button key={p.id} type="button" className={provider === p.id ? 'on' : ''}
                      aria-pressed={provider === p.id}
                      onClick={() => setProvider(p.id)}>
                {p.id === 'anthropic' ? 'The team key' : p.name}
              </button>
            ))}
          </div>
          {provider !== 'anthropic' && (
            <>
              <p className="whose-note">
                {providerById(provider).free}{' '}
                Keys at{' '}
                <a href={providerById(provider).whereUrl} target="_blank" rel="noreferrer">
                  {providerById(provider).where}
                </a>.
              </p>
              <input type="password" value={keyDraft} onChange={e => setKeyDraft(e.target.value)}
                     placeholder={providerById(provider).hint}
                     aria-label={`${providerById(provider).name} API key`} />
              {keyDraft.trim() && providerOfKey(keyDraft) && providerOfKey(keyDraft) !== provider && (
                <p className="whose-note warn">
                  That looks like a {providerById(providerOfKey(keyDraft)!).name} key.
                  Saving it will switch to {providerById(providerOfKey(keyDraft)!).name}.
                </p>
              )}
              <button onClick={saveKey} disabled={!keyDraft.trim()}>Save key</button>
            </>
          )}
        </details>
      )}

      {needKey && (
        <div className="keybox">
          <p>
            Paste an API key and the studio reads your scripts for you. It stays in this
            browser and is sent only to the AI you picked — this page has no server of its
            own to send it to.
          </p>

          {/* Gemini and Grok both have a free tier, which is the point of
              offering them: the people writing these videos are not the
              people with an API budget. */}
          <div className="whose" role="group" aria-label="Whose AI reads the script">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                type="button"
                className={provider === p.id ? 'on' : ''}
                aria-pressed={provider === p.id}
                onClick={() => setProvider(p.id)}
              >{p.name}</button>
            ))}
          </div>
          <p className="whose-note">
            {providerById(provider).free}{' '}
            Keys at{' '}
            <a href={providerById(provider).whereUrl} target="_blank" rel="noreferrer">
              {providerById(provider).where}
            </a>.
          </p>

          <input type="password" value={keyDraft} onChange={e => setKeyDraft(e.target.value)}
                 placeholder={providerById(provider).hint}
                 aria-label={`${providerById(provider).name} API key`} />

          {/* A key pasted into the wrong box comes back as "unauthorised",
              which reads like a bad key rather than one in the wrong place. */}
          {keyDraft.trim() && providerOfKey(keyDraft) && providerOfKey(keyDraft) !== provider && (
            <p className="whose-note warn">
              That looks like a {providerById(providerOfKey(keyDraft)!).name} key.
              Saving it will switch to {providerById(providerOfKey(keyDraft)!).name}.
            </p>
          )}

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

      {step === 'fill' && (
        <>
          <label htmlFor="script">Paste the script</label>
          <textarea id="script" value={script} onChange={e => setScript(e.target.value)}
                    placeholder="Paste the finalized script, including its [Internal team adds: UI — ...] markers." />
          <p className="hint">The shop, the customer, the items and the theme are all read out of the script. Only fill in an override below if the script gets one of them wrong.</p>

          <div className="shape">
            <span className="shape-k">Filmed on</span>
            {[['', 'Let the script decide'], ['phone', 'A phone'], ['laptop', 'A laptop']].map(([value, label]) => (
              <button
                key={value || 'auto'}
                type="button"
                className={'shape-pick' + (shape === value ? ' on' : '')}
                onClick={() => setShape(value)}
              >{label}</button>
            ))}
          </div>

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
          {!ready && (
            <p className="hint">
              {TEAM_MODE
                ? 'Sign in above to have the studio read the script for you — or use the free way below, which needs no sign-in.'
                : 'Add an API key above to have the studio read the script for you — Gemini and Grok have free tiers — or use the copy-and-paste way below, which needs no key at all.'}
            </p>
          )}

          {/* The studio can read the script itself, or hand the job to
              whatever chat tool you already have open. Both end at the same
              shot list and the same validator. */}
          <details className="freepath">
            <summary>Or use another AI — free, no key needed</summary>
            <p className="hint">
              Copy the instructions — your script is already inside them — paste the lot into
              ChatGPT, Gemini, Grok or whatever you use, and bring its answer back here. The studio
              checks a pasted shot list exactly as it checks its own, so anything wrong is caught
              before the video is made.
            </p>
            <div className="row">
              <button className="secondary" onClick={copyBriefing} disabled={!script.trim()}>
                {copied ? 'Copied' : 'Copy the instructions'}
              </button>
              <button className="secondary" onClick={writeItMyself}>
                I have a shot list — paste it
              </button>
            </div>
            {fallbackBriefing && (
              <textarea className="recipe" readOnly value={fallbackBriefing}
                        aria-label="The instructions, to copy by hand" />
            )}
          </details>
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
          {byHand && (
            <div className="note">
              Paste the shot list here. If you have not got one yet, go Back and copy the
              instructions into the AI of your choice first.
            </div>
          )}
          <div className="sl-switch">
            <label htmlFor="recipe">The shot list — change anything that looks wrong</label>
            <button type="button" className="sl-toggle" aria-pressed={asForm}
                    onClick={() => setAsForm(v => !v)}>
              {asForm ? 'Show it as text' : 'Adjust it in a form'}
            </button>
          </div>

          {asForm
            ? <ShotListForm recipe={recipe} onChange={setRecipe} />
            : <textarea id="recipe" className="recipe" value={recipe}
                        onChange={e => setRecipe(e.target.value)} />}

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

      {TEAM_MODE && (
        <details className="freepath checkbox">
          <summary>Not working on this machine? Run a check</summary>
          <p className="hint">
            This walks from this browser to the studio to Claude and says which step fails.
            It sends one tiny request, so it costs almost nothing.
          </p>
          <div className="row">
            <button className="secondary" onClick={check} disabled={checking}>
              {checking ? 'Checking…' : 'Run the check'}
            </button>
            {checks && (
              <button className="secondary" onClick={copyChecks}>
                {copiedError ? 'Copied' : 'Copy the result'}
              </button>
            )}
          </div>
          {checks && (
            <ul className="checks">
              {checks.map(step => (
                <li key={step.name} className={step.outcome}>
                  <strong>{step.name}</strong>
                  <div>{step.detail}</div>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}

      {error && (
        <div className="note error">
          {error}
          {/* Shown, not folded away. Twice now a fault has been reported with
              this collapsed, so the one line that identifies it was missing
              from the screenshot - which is the page's fault, not the
              reporter's. The button is here because an error on this screen is
              nearly always going to be pasted to somebody else. */}
          {errorDetail && errorDetail !== error && (
            <div className="detail">
              <div className="detail-head">
                <span>What it said exactly</span>
                <button className="linkbtn" onClick={copyError}>
                  {copiedError ? 'Copied' : 'Copy this'}
                </button>
              </div>
              <code>{errorDetail}</code>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
