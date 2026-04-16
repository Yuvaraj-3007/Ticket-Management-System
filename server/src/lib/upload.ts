import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

// H-2 — cross-validate MIME type against file extension so an SVG/HTML
// disguised as image/jpeg (correct MIME, wrong extension) is still rejected
const MIME_TO_EXT: Record<string, Set<string>> = {
  "image/jpeg": new Set([".jpg", ".jpeg", ".jfif", ".jpe"]),
  "image/jpg":  new Set([".jpg", ".jpeg", ".jfif", ".jpe"]), // non-standard alias some browsers send
  "image/png":  new Set([".png"]),
  "image/gif":  new Set([".gif"]),
  "image/webp": new Set([".webp"]),
};

// H-3 — magic byte (file signature) validation
// Cross-checks the actual file bytes against known image signatures so a
// polyglot file (e.g. GIF header + HTML payload) cannot slip through the
// MIME / extension gate above.
const MAGIC_SIGNATURES: { signature: number[]; mimeType: string }[] = [
  { signature: [0xFF, 0xD8, 0xFF],             mimeType: "image/jpeg" },  // JPEG / JFIF
  { signature: [0x89, 0x50, 0x4E, 0x47],       mimeType: "image/png"  },  // PNG
  { signature: [0x47, 0x49, 0x46, 0x38],       mimeType: "image/gif"  },  // GIF87a / GIF89a
  { signature: [0x52, 0x49, 0x46, 0x46],       mimeType: "image/webp" },  // WEBP (RIFF container)
];

/**
 * Reads the first 12 bytes of a saved file and verifies that they match a
 * known image magic-byte signature.  Returns `false` for any file that does
 * not start with a recognised signature, or for WEBP files whose RIFF chunk
 * sub-type identifier (bytes 8-11) is not "WEBP".
 */
export async function validateMagicBytes(filepath: string): Promise<boolean> {
  const fd = await fs.promises.open(filepath, "r");
  try {
    const buffer = Buffer.alloc(12);
    await fd.read(buffer, 0, 12, 0);
    for (const { signature, mimeType } of MAGIC_SIGNATURES) {
      if (signature.every((byte, i) => buffer[i] === byte)) {
        // WEBP uses a generic RIFF container — confirm the sub-type is WEBP
        if (mimeType === "image/webp") {
          return buffer.slice(8, 12).toString("ascii") === "WEBP";
        }
        return true;
      }
    }
    return false;
  } finally {
    await fd.close();
  }
}

export const uploadArray = multer({
  storage,
  limits: { fileSize: 1 * 1024 * 1024, files: 5 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = MIME_TO_EXT[file.mimetype];
    if (allowedExts?.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, GIF, WEBP) are allowed"));
    }
  },
}).array("attachments", 5);
