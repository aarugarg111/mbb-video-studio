import { unzipSync } from 'fflate';

const API = 'https://api.github.com';

function repo() {
  const value = process.env.GITHUB_REPO;
  if (!value) throw new Error('GITHUB_REPO is not set.');
  return value;
}

function headers() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

/* repository_dispatch does not return the id of the run it starts, so the
 * workflow names its run after the job id and we find it by that name. */
export function runNameFor(jobId: string) {
  return `render-${jobId}`;
}

export async function startRender(jobId: string, recipe: string) {
  const res = await fetch(`${API}/repos/${repo()}/dispatches`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'render',
      client_payload: { jobId, recipe }
    })
  });

  if (!res.ok) {
    throw new Error(`GitHub refused the render request: ${res.status} ${await res.text()}`);
  }
}

export async function findRun(jobId: string) {
  const res = await fetch(
    `${API}/repos/${repo()}/actions/workflows/render.yml/runs?per_page=50`,
    { headers: headers(), cache: 'no-store' }
  );
  if (!res.ok) return null;

  const body = await res.json();
  const wanted = runNameFor(jobId);
  const run = (body.workflow_runs ?? []).find((r: any) => r.name === wanted);
  if (!run) return null;

  return { id: run.id, status: run.status, conclusion: run.conclusion };
}

export async function findArtifact(runId: number, jobId: string) {
  const res = await fetch(`${API}/repos/${repo()}/actions/runs/${runId}/artifacts`, {
    headers: headers(),
    cache: 'no-store'
  });
  if (!res.ok) return null;

  const body = await res.json();
  const artifact = (body.artifacts ?? []).find(
    (a: any) => a.name === `video-${jobId}`
  );
  return artifact ? { id: artifact.id } : null;
}

/* An artifact is always a zip, even holding one file. */
export function pickMp4(zipped: Uint8Array): Uint8Array {
  const files = unzipSync(zipped);
  const name = Object.keys(files).find(f => f.endsWith('.mp4'));
  if (!name) throw new Error('The artifact contained no mp4.');
  return files[name];
}

export async function downloadArtifact(artifactId: number) {
  const res = await fetch(
    `${API}/repos/${repo()}/actions/artifacts/${artifactId}/zip`,
    { headers: headers(), redirect: 'follow' }
  );
  if (!res.ok) throw new Error(`Could not download the artifact: ${res.status}`);

  return pickMp4(new Uint8Array(await res.arrayBuffer()));
}
