#!/usr/bin/env node
// Unpacks a self-extracting design-tool export (a "Bundled Page" containing
// __bundler/manifest + __bundler/template <script> islands) into a plain
// static page plus real asset files under assets/, instead of the runtime
// blob-URL unpacking the bundle does in the browser.
//
// Usage:
//   node scripts/unpack.mjs                # unpack every exports/*.html
//   node scripts/unpack.mjs exports/Foo.html [more files...]
//
// Drop new page exports (Services.html, Contact.html, Book.html, ...) into
// exports/ and re-run. Output is <name>.dc.html in the project root, matching
// the *.dc.html links the exported pages already use for navigation.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const exportsDir = path.join(root, 'exports');
const assetsDir = path.join(root, 'assets');

const MIME_DIRS = {
  'image/webp': 'images',
  'image/png': 'images',
  'image/jpeg': 'images',
  'image/svg+xml': 'images',
  'font/woff2': 'fonts',
  'font/woff': 'fonts',
  'text/javascript': 'js',
  'application/javascript': 'js',
};
const MIME_EXT = {
  'image/webp': '.webp',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/svg+xml': '.svg',
  'font/woff2': '.woff2',
  'font/woff': '.woff',
  'text/javascript': '.js',
  'application/javascript': '.js',
};

function extractScriptIsland(html, type) {
  const marker = `<script type="${type}">`;
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const contentStart = start + marker.length;
  const end = html.indexOf('</script>', contentStart);
  if (end === -1) return null;
  return html.slice(contentStart, end);
}

function unpackFile(srcPath) {
  const raw = fs.readFileSync(srcPath, 'utf8');
  const manifestText = extractScriptIsland(raw, '__bundler/manifest');
  const templateText = extractScriptIsland(raw, '__bundler/template');
  const extResText = extractScriptIsland(raw, '__bundler/ext_resources');

  if (!manifestText || !templateText) {
    throw new Error(`${srcPath}: doesn't look like a bundled export (missing manifest/template script islands)`);
  }

  const manifest = JSON.parse(manifestText);
  const extResources = extResText ? JSON.parse(extResText) : [];
  let template = JSON.parse(templateText);

  const resourceMap = {};

  for (const uuid of Object.keys(manifest)) {
    const entry = manifest[uuid];
    const dir = MIME_DIRS[entry.mime];
    const ext = MIME_EXT[entry.mime] ?? '';
    if (!dir) {
      console.warn(`  ! skipping ${uuid}: unrecognized mime "${entry.mime}" (add it to MIME_DIRS/MIME_EXT)`);
      continue;
    }

    let buf = Buffer.from(entry.data, 'base64');
    if (entry.compressed) buf = zlib.gunzipSync(buf);

    const outDir = path.join(assetsDir, dir);
    fs.mkdirSync(outDir, { recursive: true });
    const relPath = `assets/${dir}/${uuid}${ext}`;
    fs.writeFileSync(path.join(root, relPath), buf);

    if (template.includes(uuid)) {
      template = template.split(uuid).join(relPath);
    }

    // ext_resources lists CDN URLs (e.g. React from unpkg) the runtime loads
    // lazily; when the manifest also ships that same uuid (a local copy),
    // point the runtime at our local file instead of the network.
    const extMatch = extResources.find((r) => r.uuid === uuid);
    if (extMatch) resourceMap[extMatch.id] = relPath;
  }

  if (Object.keys(resourceMap).length) {
    const resourceScript = `<script>window.__resources = ${JSON.stringify(resourceMap)};</script>\n`;
    template = template.replace(/<head[^>]*>/i, (m) => `${m}\n${resourceScript}`);
  }

  const base = path.basename(srcPath, path.extname(srcPath));
  const outName = `${base}.dc.html`;
  fs.writeFileSync(path.join(root, outName), template);
  console.log(`Unpacked ${path.relative(root, srcPath)} -> ${outName}`);
}

const args = process.argv.slice(2);
const targets = args.length
  ? args.map((a) => path.resolve(a))
  : fs.readdirSync(exportsDir).filter((f) => f.endsWith('.html')).map((f) => path.join(exportsDir, f));

if (!targets.length) {
  console.error('No exports found. Drop a bundled *.html export into exports/ first.');
  process.exit(1);
}

for (const t of targets) unpackFile(t);
