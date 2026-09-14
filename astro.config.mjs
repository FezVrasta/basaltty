// @ts-check
import { defineConfig } from "astro/config";
import hashedMedia from "./src/hashed-media.mjs";

/**
 * Where the site is published.
 *
 * A GitHub Pages *user* site — `basaltty.github.io` — is served from the root,
 * so no base path. A project site is served under the repository's name, and
 * every asset has to be prefixed with it or the page comes up unstyled. The
 * workflow works out which of the two this is from the repository it is
 * building, and says so here rather than leaving it to be discovered in
 * production.
 */
export default defineConfig({
  site: process.env.SITE_URL ?? "https://basaltty.github.io",
  base: process.env.SITE_BASE ?? "/",
  build: { format: "file" },
  // The screenshots and clips are copied through from `public/`, so nothing
  // else gives them a name that changes when their contents do.
  integrations: [hashedMedia()],
});
