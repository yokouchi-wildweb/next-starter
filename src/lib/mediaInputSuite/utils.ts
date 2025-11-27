import type { FileValidationRule, FileValidationError } from "./types";

const toLowerSet = (values?: string[]) => new Set((values ?? []).map((v) => v.toLowerCase()));

export function validateFile(file: File, rule?: FileValidationRule): FileValidationError | null {
  if (!rule) return null;
  const { allowedExtensions, allowedMimeTypes, maxSizeBytes } = rule;

  const mimeSet = toLowerSet(allowedMimeTypes);
  if (mimeSet.size > 0 && !mimeSet.has(file.type.toLowerCase())) {
    return { type: "mime", message: "許可されていないファイル形式です", fileName: file.name };
  }

  const extSet = toLowerSet(allowedExtensions);
  if (extSet.size > 0) {
    const dotIndex = file.name.lastIndexOf(".");
    const ext = dotIndex >= 0 ? file.name.slice(dotIndex + 1).toLowerCase() : "";
    if (!extSet.has(ext)) {
      return { type: "extension", message: "許可されていない拡張子です", fileName: file.name };
    }
  }

  if (typeof maxSizeBytes === "number" && Number.isFinite(maxSizeBytes) && file.size > maxSizeBytes) {
    return {
      type: "size",
      message: "ファイルサイズが大きすぎます",
      fileName: file.name,
      maxSizeBytes,
    };
  }

  return null;
}

export function formatValidationError(error: FileValidationError): string {
  switch (error.type) {
    case "mime":
      return error.message;
    case "extension":
      return error.message;
    case "size": {
        const size = formatBytes(error.maxSizeBytes);
        return `${error.message} (上限: ${size})`;
      }
    default:
      return "ファイルが選択できませんでした";
  }
}

export function formatBytes(size?: number | null): string {
  if (typeof size !== "number" || Number.isNaN(size)) return "";
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}
