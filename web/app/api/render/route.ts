import { randomUUID } from 'node:crypto';
import { startRender } from '@/lib/github';
import { parse } from '../../../../src/recipe.js';
import { catalogue } from '../../../../screens/index.js';

export async function POST(req: Request) {
  const { recipe } = await req.json();

  if (typeof recipe !== 'string' || !recipe.trim()) {
    return Response.json({ error: 'A recipe is required.' }, { status: 400 });
  }

  /* The SAME validator the renderer uses, so a broken recipe fails here in a
   * second instead of after waiting two and a half minutes for a runner to
   * boot and reject it. Importing the renderer's own module rather than
   * reimplementing the rules is the point - two copies would drift. */
  const checked = parse(recipe, catalogue());
  if (checked.errors) {
    return Response.json({ errors: checked.errors }, { status: 400 });
  }

  const jobId = randomUUID();

  try {
    await startRender(jobId, recipe);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 502 });
  }

  return Response.json({ id: jobId, warnings: checked.warnings }, { status: 202 });
}
