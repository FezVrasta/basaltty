# basaltty.dev — the Basaltty landing page

Built with [Astro](https://astro.build), published to GitHub Pages at
<https://fezvrasta.github.io/basaltty/> by `.github/workflows/pages.yml`.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
```

## Where the page comes from

`src/landing/head.html` and `src/landing/body.html` are the Claude Design
project, imported verbatim. `src/pages/index.astro` puts them in a document and
adds the things a page needs and a design canvas does not: the title, the
description, the social card, the icon.

They are imported as raw HTML rather than pasted into the `.astro` file, because
Astro reads `{` in markup as an expression and the design has thousands of them
in inline styles. Keeping the design byte-for-byte also means re-importing it is
a file copy rather than a merge.

## Where the pictures come from

`public/media/` is generated from the app itself, in the app's own repository:

```bash
# in basaltty-source
./Tools/capture/capture.sh              # regenerate from the app as it stands
./Tools/capture/publish-media.sh ../basaltty   # copy them here
```

They are committed here because this repository is the one that publishes them
and cannot reach the app's. Do not edit them by hand — a capture run overwrites
the lot.

## The app

The terminal itself lives in `basaltty-source`, private. This repository is the
website only, and is public because GitHub Pages on the free plan is.
