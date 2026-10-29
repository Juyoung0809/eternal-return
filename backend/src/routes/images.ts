import { Router } from "express";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const imagesRouter = Router();

// Fankit art lives in a public Google Drive. Google answers hotlinked requests (ones
// carrying a browser Referer) with 429s, so browsers load images through here instead:
// the server fetches each file once without a Referer and keeps it on disk.
const CACHE_DIR = path.resolve(import.meta.dirname, "..", "..", "data", "images");
const ALLOWED_WIDTHS = new Set([128, 256, 1000]); // sizes the importer asks for
const DRIVE_ID = /^[A-Za-z0-9_-]{10,100}$/;

// GET /api/images/:fileId?w=256 — a Drive image at one of the allowed widths
imagesRouter.get("/:fileId", async (req, res) => {
  const { fileId } = req.params;
  const width = Number(req.query.w);
  if (!DRIVE_ID.test(fileId) || !ALLOWED_WIDTHS.has(width)) {
    res.status(400).json({ error: "invalid image id or width" });
    return;
  }

  const cachePath = path.join(CACHE_DIR, `${fileId}_w${width}`);
  let body: Buffer;
  let contentType = "image/png";
  try {
    body = await readFile(cachePath);
    contentType = (await readFile(`${cachePath}.type`, "utf8").catch(() => contentType)) || contentType;
  } catch {
    const upstream = await fetch(`https://lh3.googleusercontent.com/d/${fileId}=w${width}`);
    if (!upstream.ok) {
      res.status(502).json({ error: `image upstream responded ${upstream.status}` });
      return;
    }
    body = Buffer.from(await upstream.arrayBuffer());
    contentType = upstream.headers.get("content-type") ?? contentType;
    await mkdir(CACHE_DIR, { recursive: true });
    await Promise.all([writeFile(cachePath, body), writeFile(`${cachePath}.type`, contentType)]);
  }

  // Drive file ids are immutable, so browsers can cache these for a long time.
  res.set("Cache-Control", "public, max-age=604800, immutable");
  res.type(contentType).send(body);
});
