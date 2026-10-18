/*
 * Packs the builds in dist/ into store-ready archives in artifacts/:
 *
 *   next-color-picker-<version>-chrome.zip   Chrome Web Store
 *   next-color-picker-<version>-firefox.zip  addons.mozilla.org
 *   next-color-picker-<version>-source.zip   source code for the AMO review
 *
 * AMO requires the source of minified or bundled code. The source archive is
 * made with `git archive` from HEAD, so uncommitted changes are not included.
 *
 * Run `npm run build` first; `npm run package` does both.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cmd as webExt } from 'web-ext';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACTS = path.join(ROOT, 'artifacts');
const BROWSERS = ['chrome', 'firefox'];

const { name, version } = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
await mkdir(ARTIFACTS, { recursive: true });

for (const browser of BROWSERS) {
  const sourceDir = path.join(ROOT, 'dist', browser);
  if (!existsSync(sourceDir)) {
    console.error(`✖ ${path.relative(ROOT, sourceDir)} is missing, run "npm run build" first`);
    process.exit(1);
  }

  await webExt.build(
    {
      sourceDir,
      artifactsDir: ARTIFACTS,
      filename: `${name}-${version}-${browser}.zip`,
      overwriteDest: true
    },
    { shouldExitProgram: false }
  );
}

const sourceArchive = path.join(ARTIFACTS, `${name}-${version}-source.zip`);
execFileSync('git', ['archive', '--format=zip', `--output=${sourceArchive}`, 'HEAD'], { cwd: ROOT });
console.log(`Source code archive: ${path.relative(ROOT, sourceArchive)}`);
