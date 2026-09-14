import { createHash } from "node:crypto";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Puts a content hash in the name of every file under `public/media`.
 *
 * Astro hashes what it bundles, but `public/` is copied through untouched, and
 * that is where the screenshots and the clips live. Their names never change,
 * so a browser that has one has it for as long as its cache says, which is how
 * a re-recorded video sat behind an old copy of itself with the same URL, on a
 * page that had already been told the file was fixed.
 *
 * The source keeps the plain names: `media/themes.mp4` is what is written in
 * the markup and what `publish-media.sh` copies in. The renaming happens to the
 * built site, where the name is nobody's to type, and every reference to it in
 * the emitted HTML is rewritten to match. A file whose bytes have not changed
 * keeps its hash, and so keeps being cached.
 */
export default function hashedMedia() {
  return {
    name: "basaltty:hashed-media",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const media = join(root, "media");

        let files;
        try {
          files = await readdir(media);
        } catch {
          logger.warn("no media directory in the build, nothing to hash");
          return;
        }

        const renames = new Map();
        for (const file of files) {
          // Already hashed, from a build that was not cleaned first.
          if (/\.[0-9a-f]{8}\./.test(file)) continue;
          const path = join(media, file);
          const bytes = await readFile(path);
          const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
          const extension = extname(file);
          const hashed = `${basename(file, extension)}.${hash}${extension}`;
          await rename(path, join(media, hashed));
          renames.set(`media/${file}`, `media/${hashed}`);
        }

        // Longest first, so a name that is the start of another one cannot
        // eat it.
        const ordered = [...renames.entries()].sort(
          ([a], [b]) => b.length - a.length,
        );

        let rewritten = 0;
        for (const page of await pages(root)) {
          const before = await readFile(page, "utf8");
          let after = before;
          for (const [from, to] of ordered) after = after.split(from).join(to);
          if (after === before) continue;
          await writeFile(page, after);
          rewritten += 1;
        }

        // Every name the pages now ask for has to be a file that is here. A
        // reference the renaming missed is a picture that 404s, which looks
        // exactly like a picture nobody got round to adding.
        const present = new Set(await readdir(media));
        const missing = new Set();
        for (const page of await pages(root)) {
          const html = await readFile(page, "utf8");
          for (const [, name] of html.matchAll(/media\/([\w.-]+\.\w+)/g)) {
            if (!present.has(name)) missing.add(name);
          }
        }
        if (missing.size) {
          throw new Error(
            `the built pages point at media that is not there: ${[...missing].join(", ")}`,
          );
        }

        logger.info(
          `${renames.size} media file(s) hashed, ${rewritten} page(s) rewritten`,
        );
      },
    },
  };
}

/** Every HTML file in the built site. */
async function pages(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await pages(path)));
    else if (entry.name.endsWith(".html")) found.push(path);
  }
  return found;
}
