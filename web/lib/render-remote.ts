/* Rendering on a machine instead of in this browser.
 *
 * The browser render needs WebCodecs H.264 encoding, which Safari does not
 * have and no phone browser has usefully - so on a phone the studio got as far
 * as a shot list and stopped. This asks the render service for the same clip
 * the command line makes, and waits.
 *
 * Deliberately the same shape as renderVideo: recipe in, Blob out, progress
 * reported as frames done out of frames total. The page should not have to
 * care which one made the video.
 */

export type Progress = (done: number, total: number) => void;

export interface RemoteOptions {
  onProgress?: Progress;
  /* Poked by the tests; nothing else should need it. */
  fetchImpl?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
}

/* Often enough to feel live, rarely enough that a long clip is not thousands
 * of requests. A 17-second clip is about 500 frames and a couple of minutes. */
export const POLL_MS = 1500;

/* A render that has not finished in a quarter of an hour is not going to. */
export const GIVE_UP_MS = 15 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export interface RemoteStatus {
  state: 'queued' | 'rendering' | 'done' | 'failed';
  done: number;
  total?: number;
  place: number;
  ready?: boolean;
  error?: string;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (Array.isArray(body?.problems) && body.problems.length) {
      return [body.error, ...body.problems.map((p: string) => '· ' + p)].join('\n');
    }
    if (typeof body?.error === 'string') return body.error;
  } catch { /* a non-JSON body means the message below is the best there is */ }
  return fallback;
}

/* Whether this studio has a render service behind it. The page asks before
 * offering to render for you, so that a browser which cannot encode is told
 * what it can do rather than discovering it cannot at the end. */
export async function canRenderRemotely(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl('/api/session');
    if (!res.ok) return false;
    return Boolean((await res.json())?.canRender);
  } catch {
    return false;
  }
}

export async function renderRemotely(recipeText: string, opts: RemoteOptions = {}): Promise<Blob> {
  const http = opts.fetchImpl ?? fetch;
  const wait = opts.wait ?? sleep;
  const report = opts.onProgress;

  const started = await http('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipe: recipeText }),
    signal: opts.signal
  });
  if (!started.ok) {
    throw new Error(await readError(started, 'The render machine would not take the shot list.'));
  }
  const { id } = await started.json();
  if (!id) throw new Error('The render machine did not say which video it was making.');

  const deadline = Date.now() + GIVE_UP_MS;

  for (;;) {
    if (Date.now() > deadline) {
      throw new Error('The render is taking longer than it should. Try a shorter clip, or render in Chrome.');
    }

    const res = await http(`/api/render/${id}`, { signal: opts.signal });
    if (!res.ok) throw new Error(await readError(res, 'The render machine stopped answering.'));
    const status: RemoteStatus = await res.json();

    if (status.state === 'failed') {
      throw new Error(status.error || 'The render failed on the machine.');
    }
    if (status.state === 'done') break;

    /* While it is still in the queue there are no frames to count, so the
     * place in the line is the only honest thing to show. */
    if (report) {
      if (status.state === 'queued') report(0, 0);
      else report(status.done ?? 0, status.total ?? 0);
    }

    await wait(POLL_MS);
  }

  const video = await http(`/api/render/${id}/video`, { signal: opts.signal });
  if (!video.ok) throw new Error(await readError(video, 'The video could not be fetched.'));
  const blob = await video.blob();
  /* A zero-byte body would save as a file that will not play, which looks like
   * the tool having worked. */
  if (blob.size === 0) throw new Error('The render machine sent an empty video. Try again.');
  if (report) report(1, 1);
  return blob;
}

/* How far along, in words, for a page that has a queue to explain. */
export function describe(status: RemoteStatus): string {
  if (status.state === 'queued') {
    return status.place > 1
      ? `Waiting — ${status.place} videos ahead of yours.`
      : 'Waiting for the render machine…';
  }
  if (status.state === 'rendering' && status.total) {
    return `Rendering frame ${status.done} of ${status.total}…`;
  }
  return 'Rendering…';
}
