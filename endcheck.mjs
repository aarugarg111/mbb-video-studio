import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { execFileSync } from 'node:child_process';
const FF = process.env.HOME + '/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const names = ['agarwal-fast-billing','whatsapp-share','diwali-theme','pharmacy-stock','party-ledger','kirana-snacks','momos-day','scan-record','stock-scan','cashflo-collections','construction-tally-mcf','desktop-billing','desktop-collections'];
for (const n of names) {
  const r = yaml.load(readFileSync(`recipes/${n}.yaml`, 'utf8'));
  const end = r.shots.reduce((t, s) => t + s.duration, 0);
  const last = r.shots[r.shots.length - 1].screen;
  const at = Math.max(0, end - 0.25);
  execFileSync(FF, ['-v','error','-ss',String(at),'-i',`out/${n}/${n}.mp4`,'-frames:v','1','-vf','scale=260:-2','-y',`out/endcheck/${n}.png`]);
  console.log(`${n.padEnd(26)} ends on ${last.padEnd(22)} (${end.toFixed(1)}s)`);
}
