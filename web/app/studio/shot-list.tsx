'use client';

/* The shot list as a form.
 *
 * Optional, always: the studio writes a shot list from the script and renders
 * it without anybody opening this. It is here for the next part - a scene that
 * runs too long, a tap in the wrong place, a figure the script states and the
 * studio worked out instead - which until now meant editing YAML.
 *
 * It edits the same text the box underneath holds, so the two are never out of
 * step and nothing new has to be taught to the renderer.
 */

import { useMemo, useState } from 'react';
import * as yaml from 'js-yaml';
import { SCREENS } from '../../lib/schema';
import { screenLabel, stepsFor, stepLabel } from '../../lib/friendly';

type Action = { at?: number; do?: string; target?: string; text?: string; distance?: number; duration?: number };
type Shot = { screen?: string; duration?: number; actions?: Action[] };
type Doc = { shots?: Shot[]; sales?: { dayTotal?: number | null; netProfit?: number | null } };

/* A screen belongs to the laptop set if its name says so - the same split the
   renderer makes, without importing the renderer into the browser. */
const isLaptop = (screen: string) => screen.includes('desktop') || screen === 'tally-receivables';

export function ShotListForm({ recipe, onChange }: { recipe: string; onChange: (next: string) => void }) {
  /* Which scene is being carried, and which one it is hovering over. Local to
   * the form: nothing about a drag belongs in the shot list itself. */
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const parsed = useMemo(() => {
    try {
      const doc = yaml.load(recipe) as Doc;
      if (!doc || typeof doc !== 'object' || !Array.isArray(doc.shots)) return null;
      return doc;
    } catch {
      return null;
    }
  }, [recipe]);

  if (!parsed) {
    return (
      <div className="note">
        The form could not read this shot list, so it is left as text. Fix whatever the
        render says is wrong and it will come back.
      </div>
    );
  }

  const shots = parsed.shots as Shot[];
  const laptop = shots.some(s => isLaptop(String(s.screen ?? '')));
  const choices = Object.keys(SCREENS).filter(s => isLaptop(s) === laptop);

  /* Every change goes back out as the same YAML the box holds. Comments do not
     survive a rewrite, which is why the box is still there and still wins. */
  const commit = (next: Doc) => onChange(yaml.dump(next));
  const edit = (fn: (d: Doc) => void) => {
    const next = JSON.parse(JSON.stringify(parsed)) as Doc;
    fn(next);
    commit(next);
  };

  /* Carry a scene to another place in the running order. The scene keeps
   * everything it had - its screen, its length, its steps and their timings -
   * because only where it sits is changing. */
  const move = (fromIndex: number | null, toIndex: number) => {
    setFrom(null);
    setOver(null);
    if (fromIndex === null || fromIndex === toIndex) return;
    if (toIndex < 0 || toIndex >= shots.length) return;
    edit(d => {
      const [carried] = d.shots!.splice(fromIndex, 1);
      d.shots!.splice(toIndex, 0, carried);
    });
  };

  const total = shots.reduce((t, s) => t + (Number(s.duration) || 0), 0);
  const sales = parsed.sales ?? {};
  const day = Number(sales.dayTotal);
  const net = Number(sales.netProfit);

  const setFigure = (key: 'dayTotal' | 'netProfit', value: string) => edit(d => {
    d.sales = d.sales ?? {};
    if (value.trim() === '') delete d.sales[key];
    else d.sales[key] = Number(value);
    if (!Object.keys(d.sales).length) delete d.sales;
  });

  return (
    <div className="sl-form">
      {shots.map((shot, i) => {
        const screen = String(shot.screen ?? '');
        const label = screenLabel(screen);
        const dur = Number(shot.duration) || 3;
        const actions = shot.actions ?? [];
        const offered = stepsFor(screen);
        const taken = actions.map(a => a.target);

        return (
          <div
            className={`sl-scene${over === i && from !== null && from !== i ? ' sl-over' : ''}${from === i ? ' sl-lifted' : ''}`}
            key={i}
            onDragOver={e => { if (from !== null) { e.preventDefault(); setOver(i); } }}
            onDrop={e => { e.preventDefault(); move(from, i); }}
          >
            <div className="sl-scene-head">
              {/* Hold this to carry the scene somewhere else. The handle rather
                  than the whole card, because the card is full of sliders and
                  dragging one of those should move the slider. */}
              <span
                className="sl-grip"
                draggable
                role="button"
                tabIndex={0}
                aria-label={`Move scene ${i + 1}. Use the arrows, or hold to drag.`}
                onDragStart={e => { setFrom(i); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setFrom(null); setOver(null); }}
              >⠿</span>
              <span className="sl-num">{i + 1}</span>
              <span className="sl-scene-main">
                <span className="sl-scene-title">{label.name}</span>
                {label.blurb && <span className="sl-scene-sub">{label.blurb}</span>}
              </span>
              {/* The same move without a mouse. */}
              <span className="sl-moves">
                <button type="button" className="sl-move" disabled={i === 0}
                        aria-label={`Move scene ${i + 1} earlier`}
                        onClick={() => move(i, i - 1)}>↑</button>
                <button type="button" className="sl-move" disabled={i === shots.length - 1}
                        aria-label={`Move scene ${i + 1} later`}
                        onClick={() => move(i, i + 1)}>↓</button>
              </span>
              <button type="button" className="sl-x" aria-label={`Remove scene ${i + 1}`}
                      onClick={() => edit(d => { d.shots!.splice(i, 1); })}>×</button>
            </div>

            <label className="sl-field">
              <span className="sl-k">Screen</span>
              <select value={screen} onChange={e => edit(d => {
                d.shots![i].screen = e.target.value;
                d.shots![i].actions = [];
              })}>
                {choices.map(id => <option key={id} value={id}>{screenLabel(id).name}</option>)}
              </select>
            </label>

            <label className="sl-field">
              <span className="sl-k">How long it is on screen</span>
              <span className="sl-knob">
                <input type="range" min={1.5} max={14} step={0.5} value={dur}
                       onChange={e => edit(d => { d.shots![i].duration = Number(e.target.value); })} />
                <span className="sl-val">{dur.toFixed(1)}s</span>
              </span>
            </label>

            <div className="sl-steps">
              {actions.length === 0 && (
                <p className="sl-none">Nothing happens on this one — it just plays.</p>
              )}

              {actions.map((a, j) => {
                const scroll = a.do === 'scroll';
                const at = Number(a.at) || 0;
                return (
                  <div className="sl-step" key={j}>
                    <span className="sl-when">{at.toFixed(1)}s</span>
                    <span className="sl-what">
                      <span className={`sl-pill${scroll ? ' scroll' : ''}`}>
                        {scroll ? 'Scroll' : a.do === 'type' ? 'Type' : 'Tap'}
                      </span>{' '}
                      <span className="sl-step-name">
                        {scroll ? 'Scroll down the list' : stepLabel(screen, String(a.target ?? ''))}
                      </span>
                      <span className="sl-knob">
                        <input type="range" min={0.2} max={Math.max(0.4, dur - 0.3)} step={0.1} value={at}
                               onChange={e => edit(d => { d.shots![i].actions![j].at = Number(e.target.value); })} />
                        <span className="sl-val">at {at.toFixed(1)}s</span>
                      </span>
                      {scroll && (
                        <span className="sl-knob">
                          <input type="range" min={0.4} max={3} step={0.1}
                                 value={Number(a.duration) || 1.2}
                                 onChange={e => edit(d => { d.shots![i].actions![j].duration = Number(e.target.value); })} />
                          <span className="sl-val">over {(Number(a.duration) || 1.2).toFixed(1)}s</span>
                        </span>
                      )}
                    </span>
                    <button type="button" className="sl-x" aria-label="Remove step"
                            onClick={() => edit(d => { d.shots![i].actions!.splice(j, 1); })}>×</button>
                  </div>
                );
              })}

              {offered.length > 0 && (
                <select className="sl-add" value="" onChange={e => {
                  const id = e.target.value;
                  if (!id) return;
                  edit(d => {
                    const list = d.shots![i].actions ?? (d.shots![i].actions = []);
                    const when = Math.min(dur - 0.3, (list.length + 1) * 1.4);
                    list.push(id === '__scroll'
                      ? { at: Number(when.toFixed(1)), do: 'scroll', distance: 300, duration: 1.6 }
                      : { at: Number(when.toFixed(1)), do: 'tap', target: id });
                  });
                }}>
                  <option value="">Add something that happens…</option>
                  {offered.filter(s => s.scroll || !taken.includes(s.id))
                    .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>
          </div>
        );
      })}

      <div className="sl-row">
        <button type="button" className="secondary" onClick={() => edit(d => {
          d.shots!.push({ screen: choices[0], duration: 3, actions: [] });
        })}>Add a scene</button>
        <span className="sl-total">Total <b>{total.toFixed(1)}s</b></span>
      </div>

      <div className="sl-figures">
        <span className="sl-k">Figures the script says out loud</span>
        <p className="sl-none">Leave one blank and the studio works it out.</p>
        <label className="sl-field">
          <span className="sl-k">Total sale for the day</span>
          <input type="number" min={0} step={10} value={Number.isFinite(day) ? day : ''}
                 onChange={e => setFigure('dayTotal', e.target.value)} />
        </label>
        <label className="sl-field">
          <span className="sl-k">Net profit</span>
          <input type="number" min={0} step={10} value={Number.isFinite(net) ? net : ''}
                 onChange={e => setFigure('netProfit', e.target.value)} />
        </label>
        {Number.isFinite(day) && Number.isFinite(net) && net > day && (
          <p className="sl-warn">A profit cannot be bigger than the sale it came out of.</p>
        )}
      </div>
    </div>
  );
}
