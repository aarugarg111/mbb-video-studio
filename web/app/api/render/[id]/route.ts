import { findRun } from '@/lib/github';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await findRun(id);

  /* A run takes a few seconds to appear after the dispatch, so "not found yet"
   * is normal rather than an error. */
  if (!run) return Response.json({ status: 'starting' });

  if (run.status !== 'completed') {
    return Response.json({ status: 'rendering' });
  }

  if (run.conclusion !== 'success') {
    return Response.json({
      status: 'failed',
      error: `The render job ${run.conclusion}. Check the Actions tab for the log.`
    });
  }

  return Response.json({ status: 'done' });
}
