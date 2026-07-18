# LITU Website

Static site built from single-file exports produced by the design tool's
"Bundled Page" export (a self-extracting HTML file with a custom `x-dc`
component runtime). Those exports embed every image, font, and script as
gzip+base64 data and unpack themselves into blob URLs at load time — fine for
a one-off preview, not something you want to host or edit directly. This repo
unpacks them once into a normal static file structure.

## Structure

- `exports/` — raw bundled exports as downloaded from the design tool (source
  of truth, never hand-edited)
- `scripts/unpack.mjs` — converts an `exports/*.html` bundle into a plain
  `<Name>.dc.html` page in the project root, extracting its assets into
  `assets/`
- `Home.dc.html` — the unpacked home page (generated, don't hand-edit — re-run
  `npm run unpack` instead)
- `index.html` — redirects to `Home.dc.html` so the site root loads the
  homepage
- `assets/images`, `assets/fonts`, `assets/js` — extracted images, fonts, and
  the `dc-runtime` script that renders the `x-dc` templates
- `assets/js/*.js` includes local copies of React/ReactDOM (UMD builds) so
  the page never depends on the `unpkg.com` CDN at runtime

The homepage's nav already links to `Services.dc.html`, `Contact.dc.html`,
and `Book.dc.html`. When you export those pages from the design tool, drop
each file into `exports/` (e.g. `exports/Services.html`) and run:

```sh
npm run unpack
```

This regenerates the matching `<Name>.dc.html` in the root and adds any new
assets to `assets/`, reusing existing files where the design tool re-exports
something already extracted (like the logo or fonts).

## Running locally

No build step beyond `unpack` — everything else is static HTML/CSS/JS.

```sh
npm run dev
```

Serves the site at a local URL (via `serve`). Opening `Home.dc.html` (or any
`*.dc.html` file) directly from disk also works, but a local server avoids
font-loading quirks some browsers have with `file://` origins.

## Deploying

Any static host (Netlify, Vercel, GitHub Pages, S3, etc.) works — just publish
the project root as-is.
