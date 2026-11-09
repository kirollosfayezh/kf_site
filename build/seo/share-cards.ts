/**
 * Share cards for pages whose image is not an Unsplash photo.
 *
 * Unsplash photos are cropped to 1200×630 by Unsplash itself (`ogImageUrl`),
 * so their `og:image:width/height` are true. Project screenshots shipped in
 * `public/projects/` and photos uploaded in the dashboard (R2, on
 * media.kftechsolutions.dev) are passed through at whatever size they are, so
 * no dimensions could be claimed and Facebook, LinkedIn and WhatsApp had to
 * guess the crop — sometimes dropping the picture. This crops each one once
 * per build to a 1200×630 JPEG under `/og/`, and the page then claims the
 * size like every other share image.
 *
 * A source that cannot be read or decoded leaves the page as it was (the old,
 * unsized behaviour), with a warning: a share card is never worth failing a
 * deploy over.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { PageSeo } from "../../src/lib/seo/index.ts";

const REMOTE = /^https:\/\/media\.kftechsolutions\.dev\//;
const LOCAL = /^\/(projects)\/[^?#]+\.(jpe?g|png|webp)$/i;

/** Source URL → the card's public path (or null when it could not be made). */
const made = new Map<string, Promise<string | null>>();

async function readSource(src: string, publicDir: string): Promise<Buffer> {
  if (LOCAL.test(src)) return readFile(join(publicDir, src));
  const res = await fetch(src);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function makeCard(src: string, distDir: string, publicDir: string, warnings: string[]): Promise<string | null> {
  try {
    const input = await readSource(src, publicDir);
    const name = `${createHash("sha1").update(src).digest("hex").slice(0, 16)}.jpg`;
    const out = await sharp(input)
      .rotate()
      // Screenshots are mostly the top of a page, so keep the top of the frame.
      .resize(1200, 630, { fit: "cover", position: LOCAL.test(src) ? "top" : "attention" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    await mkdir(join(distDir, "og"), { recursive: true });
    await writeFile(join(distDir, "og", name), out);
    return `/og/${name}`;
  } catch (err) {
    warnings.push(`share card for ${src} not made (${err instanceof Error ? err.message : String(err)}); the page keeps the unsized image`);
    return null;
  }
}

/** Whether this page's image needs a card made for it. */
export function needsCard(page: Pick<PageSeo, "image" | "imageSized">): boolean {
  return !!page.image && page.imageSized !== true && (LOCAL.test(page.image) || REMOTE.test(page.image));
}

/** The page with its share image swapped for a sized 1200×630 card, when one can be made. */
export async function withShareCard<T extends PageSeo>(
  page: T,
  distDir: string,
  publicDir: string,
  warnings: string[],
): Promise<T> {
  if (!needsCard(page)) return page;
  // `ogImageUrl` swaps a project .webp for its .jpg twin; crop from the
  // original either way, whichever exists.
  const src = page.image as string;
  let card = made.get(src);
  if (!card) {
    card = makeCard(src, distDir, publicDir, warnings);
    made.set(src, card);
  }
  const path = await card;
  return path ? { ...page, image: path, imageSized: true } : page;
}
