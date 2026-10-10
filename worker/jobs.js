/* A queue of one.
 *
 * Rendering a clip opens a headless Chrome, photographs several hundred frames
 * and then runs ffmpeg over them. Two of those at once on a small box means
 * both crawl and the machine may run out of memory partway, which looks to
 * whoever is waiting like the tool silently breaking. So renders run strictly
 * one at a time and everyone else is told where they are in the line.
 *
 * This file holds no Playwright and no ffmpeg: the work is handed in as a
 * function. That is what makes the queueing testable in milliseconds.
 */

export const STATES = ['queued', 'rendering', 'done', 'failed'];

/* Long enough that someone can come back to a finished video after a break,
 * short enough that a day of use does not fill the disk. */
export const KEEP_MS = 60 * 60 * 1000;

/* A refusal is kinder than a queue so long nobody's video arrives. */
export const MAX_WAITING = 20;

let counter = 0;

/* Short, unguessable, and not a number anyone could walk through: a job id is
 * the only thing standing between one person's render and another's. */
function newId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  counter += 1;
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('') + counter.toString(36);
}

export function createQueue({ run, now = () => Date.now(), keepMs = KEEP_MS, maxWaiting = MAX_WAITING }) {
  if (typeof run !== 'function') throw new Error('createQueue needs a run function.');

  const jobs = new Map();
  const waiting = [];
  let working = false;

  function sweep() {
    for (const [id, job] of jobs) {
      const settled = job.state === 'done' || job.state === 'failed';
      if (settled && now() - job.finishedAt > keepMs) {
        jobs.delete(id);
        if (job.cleanup) job.cleanup(job);
      }
    }
  }

  function place(job) {
    const index = waiting.indexOf(job.id);
    /* Zero means "being rendered now", which is what the one at the head of
     * the line is doing, so the first waiting job is second. */
    return index < 0 ? 0 : index + 1;
  }

  function view(job) {
    return {
      id: job.id,
      state: job.state,
      /* Frames rendered so far out of the total, once the total is known. A
       * clip is hundreds of frames, so this is the difference between a
       * progress bar and a spinner that looks stuck. */
      done: job.done,
      total: job.total,
      place: place(job),
      error: job.error,
      /* Whether there is a video to fetch, never where it is. The path is this
       * machine's own business, and a status reply goes straight to a browser. */
      ready: job.state === 'done' && Boolean(job.video),
      name: job.name
    };
  }

  async function pump() {
    if (working) return;
    const id = waiting.shift();
    if (id === undefined) return;
    const job = jobs.get(id);
    /* Dropped while it waited - keep going rather than stalling the line. */
    if (!job) return pump();

    working = true;
    job.state = 'rendering';
    job.startedAt = now();

    try {
      const result = await run(job, (done, total) => {
        job.done = done;
        if (total !== undefined) job.total = total;
      });
      job.state = 'done';
      job.video = result?.video;
      if (job.total !== undefined) job.done = job.total;
    } catch (err) {
      job.state = 'failed';
      job.error = err?.message || String(err);
    } finally {
      job.finishedAt = now();
      working = false;
      sweep();
      /* Not awaited: this is the tail of one job, not the caller of the next. */
      pump();
    }
  }

  return {
    submit({ recipe, name, cleanup }) {
      sweep();
      if (waiting.length >= maxWaiting) {
        throw new Error(`${waiting.length} videos are already waiting. Try again in a few minutes.`);
      }
      const job = {
        id: newId(),
        state: 'queued',
        recipe,
        name,
        cleanup,
        done: 0,
        total: undefined,
        submittedAt: now()
      };
      jobs.set(job.id, job);
      waiting.push(job.id);
      pump();
      return view(job);
    },

    status(id) {
      const job = jobs.get(id);
      return job ? view(job) : null;
    },

    /* The job itself, for the one caller that needs the file off disk. */
    find(id) {
      return jobs.get(id) ?? null;
    },

    get size() {
      return jobs.size;
    },

    get busy() {
      return working;
    },

    /* Finished jobs waiting out their hour would otherwise hold the process
     * open; the server calls this on shutdown. */
    drop(id) {
      const job = jobs.get(id);
      if (!job) return false;
      jobs.delete(id);
      const index = waiting.indexOf(id);
      if (index >= 0) waiting.splice(index, 1);
      if (job.cleanup) job.cleanup(job);
      return true;
    }
  };
}
