/* Hands the frames to ffmpeg. Settings are fixed by the spec: H.264, yuv420p
 * for player compatibility, faststart so the file streams. */

import { spawn } from 'node:child_process';
import { join } from 'node:path';

export function encode(framesDir, outPath, { fps = 30 } = {}) {
  const args = [
    '-y',
    '-framerate', String(fps),
    '-i', join(framesDir, 'f%05d.png'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outPath
  ];

  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    ff.stderr.on('data', chunk => { stderr += chunk; });

    ff.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error(
          'ffmpeg was not found on PATH. Install it with: winget install --id Gyan.FFmpeg -e\n' +
          'Then open a new terminal so PATH refreshes.'
        ));
      } else {
        reject(err);
      }
    });

    ff.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}.\n${stderr.slice(-3000)}`));
    });
  });
}
