import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../../../uploads");

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
  "image/jpeg": new Set([".jpg", ".jpeg"]),
  "image/png":  new Set([".png"]),
  "image/gif":  new Set([".gif"]),
  "image/webp": new Set([".webp"]),
};

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
