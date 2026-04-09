import { useRef, useState, useCallback } from "react";
import { X, ImageIcon, Upload } from "lucide-react";

interface ImageUploadFieldProps {
  files: File[];
  onChange: (files: File[]) => void;
}

const MAX_SIZE = 1 * 1024 * 1024; // 1 MB
const MAX_FILES = 5;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageUploadField({ files, onChange }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      const errs: string[] = [];
      const valid: File[] = [];
      const remaining = MAX_FILES - files.length;

      Array.from(incoming).slice(0, remaining).forEach((f) => {
        if (!ALLOWED.has(f.type)) {
          errs.push(`"${f.name}" is not a supported image type (JPEG, PNG, GIF, WEBP)`);
        } else if (f.size > MAX_SIZE) {
          errs.push(`"${f.name}" exceeds the 1 MB size limit`);
        } else {
          valid.push(f);
        }
      });
      if (files.length + valid.length > MAX_FILES) {
        errs.push(`Maximum ${MAX_FILES} images allowed`);
      }
      setErrors(errs);
      if (valid.length > 0) onChange([...files, ...valid]);
    },
    [files, onChange]
  );

  const remove = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    onChange(next);
    setErrors([]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Attachments <span className="text-gray-400 font-normal text-xs">(optional · max 5 images · 1 MB each)</span>
      </label>

      {/* Drop zone */}
      {files.length < MAX_FILES && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
            dragging
              ? "border-orange-400 bg-orange-50"
              : "border-gray-300 hover:border-orange-400 hover:bg-orange-50/50"
          }`}
        >
          <Upload className="w-5 h-5 text-gray-400" />
          <p className="text-sm text-gray-500">
            Drop images here or{" "}
            <span className="text-orange-500 font-medium">browse</span>
          </p>
          <p className="text-xs text-gray-400">JPEG, PNG, GIF, WEBP</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      )}

      {/* Previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, idx) => {
            const src = URL.createObjectURL(file);
            return (
              <div
                key={`${file.name}-${idx}`}
                className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200"
              >
                <img
                  src={src}
                  alt={file.name}
                  className="w-full h-full object-cover"
                  onLoad={() => URL.revokeObjectURL(src)}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(idx); }}
                  className="absolute top-1 right-1 bg-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  title="Remove"
                >
                  <X className="w-3 h-3 text-gray-700" />
                </button>
                <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">
                  {formatSize(file.size)}
                </p>
              </div>
            );
          })}
          {files.length < MAX_FILES && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-orange-400 transition-colors"
            >
              <ImageIcon className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
      )}

      {/* Errors */}
      {errors.map((e, i) => (
        <p key={i} className="text-red-500 text-xs">{e}</p>
      ))}
    </div>
  );
}
