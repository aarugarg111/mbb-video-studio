import { findRun, findArtifact, downloadArtifact } from '@/lib/github';

export const maxDuration = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const run = await findRun(id);
  if (!run || run.status !== 'completed') {
    return Response.json({ error: 'That video is not ready.' }, { status: 404 });
  }

  const artifact = await findArtifact(run.id, id);
  if (!artifact) {
    return Response.json({ error: 'No video was produced.' }, { status: 404 });
  }

  try {
    const mp4 = await downloadArtifact(artifact.id);
    return new Response(mp4 as unknown as BodyInit, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(mp4.byteLength),
        'Content-Disposition': `attachment; filename="${id}.mp4"`
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 502 });
  }
}
