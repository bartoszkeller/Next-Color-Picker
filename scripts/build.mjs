/*
 * Builds the extension for each browser into dist/<browser>/.
 *
 *   node scripts/build.mjs [--browser chrome|firefox] [--dev] [--watch]
 *
 * --browser  Build a single browser; both are built by default.
 * --dev      Skip minification and add inline source maps.
 * --watch    Rebuild on changes; implies --dev.
 *
 * The manifest is src/manifest/base.json merged with src/manifest/<browser>.json,
 * with the version taken from package.json. The JavaScript target follows the
 * minimum browser version declared in the manifest.
 */
import { watch } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BROWSERS = ['chrome', 'firefox'];

const ENTRY_POINTS = {
  background: 'src/background/index.ts',
  picker: 'src/content/picker/index.ts'
};

/** Copied as-is into the root of every build. */
const STATIC_FILES = ['public', 'LICENSE'];

const { values: args } = parseArgs({
  options: {
    browser: { type: 'string' },
    dev: { type: 'boolean', default: false },
    watch: { type: 'boolean', default: false }
  }
});

const dev = args.dev || args.watch;
const browsers = args.browser ? [args.browser] : BROWSERS;

for (const browser of browsers) {
  if (!BROWSERS.includes(browser)) {
    fail(`Unknown browser "${browser}", expected one of: ${BROWSERS.join(', ')}`);
  }
}

try {
  await Promise.all(browsers.map((browser) => (args.watch ? watchBrowser(browser) : buildBrowser(browser))));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

async function buildBrowser(browser) {
  const outDir = distDir(browser);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const manifest = await writeManifest(browser);
  await copyStaticFiles(outDir);
  await esbuild.build(bundleOptions(browser, manifest));

  log(browser, `built ${manifest.name} ${manifest.version} → ${path.relative(ROOT, outDir)}`);
}

async function watchBrowser(browser) {
  await buildBrowser(browser);

  const manifest = await buildManifest(browser);
  const context = await esbuild.context({ ...bundleOptions(browser, manifest), logLevel: 'info' });
  await context.watch();

  // esbuild only watches the bundled sources, so the manifest and static files are watched here.
  const rebuildAssets = debounce(async () => {
    try {
      await writeManifest(browser);
      await copyStaticFiles(distDir(browser));
      log(browser, 'manifest and static files updated');
    } catch (error) {
      log(browser, `asset rebuild failed: ${error instanceof Error ? error.message : error}`);
    }
  }, 100);

  for (const target of ['src/manifest', 'package.json', ...STATIC_FILES]) {
    watch(path.join(ROOT, target), { recursive: true }, rebuildAssets);
  }
  log(browser, 'watching for changes…');
}

function bundleOptions(browser, manifest) {
  return {
    absWorkingDir: ROOT,
    entryPoints: ENTRY_POINTS,
    outdir: distDir(browser),
    bundle: true,
    // Neither script may be a module: the picker is injected with
    // scripting.executeScript, and the background script is loaded as a
    // classic service worker in Chrome and as an event page in Firefox.
    format: 'iife',
    target: esbuildTarget(browser, manifest),
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    legalComments: 'none',
    plugins: [cssTextPlugin(!dev)],
    logLevel: 'warning'
  };
}

/**
 * Imports stylesheets as strings, for injection into shadow roots. In release
 * builds the CSS is minified, which the plain `text` loader would not do.
 */
function cssTextPlugin(minify) {
  return {
    name: 'css-text',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async ({ path: file }) => {
        const source = await readFile(file, 'utf8');
        const { code } = await esbuild.transform(source, { loader: 'css', minify });
        return { contents: code, loader: 'text' };
      });
    }
  };
}

async function buildManifest(browser) {
  const [base, override, pkg] = await Promise.all([
    readJson(`src/manifest/base.json`),
    readJson(`src/manifest/${browser}.json`),
    readJson('package.json')
  ]);

  // Keep the conventional key order: manifest_version, name, version, ...
  const { manifest_version, name, ...rest } = mergeDeep(base, override);
  return { manifest_version, name, version: pkg.version, ...rest };
}

async function writeManifest(browser) {
  const manifest = await buildManifest(browser);
  const json = dev ? JSON.stringify(manifest, null, 2) : JSON.stringify(manifest);
  await writeFile(path.join(distDir(browser), 'manifest.json'), `${json}\n`);
  return manifest;
}

async function copyStaticFiles(outDir) {
  for (const source of STATIC_FILES) {
    const from = path.join(ROOT, source);
    const to = source === 'public' ? outDir : path.join(outDir, path.basename(source));
    await cp(from, to, { recursive: true });
  }
}

function esbuildTarget(browser, manifest) {
  if (browser === 'chrome') return `chrome${manifest.minimum_chrome_version}`;
  return `firefox${parseInt(manifest.browser_specific_settings.gecko.strict_min_version, 10)}`;
}

/** Merges plain objects recursively; arrays are concatenated without duplicates. */
function mergeDeep(target, source) {
  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const current = result[key];

    if (Array.isArray(current) && Array.isArray(value)) {
      result[key] = [...new Set([...current, ...value])];
    } else if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = mergeDeep(current, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(file) {
  return JSON.parse(await readFile(path.join(ROOT, file), 'utf8'));
}

function distDir(browser) {
  return path.join(ROOT, 'dist', browser);
}

function debounce(fn, delay) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}

function log(browser, message) {
  console.log(`[${browser}] ${message}`);
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
