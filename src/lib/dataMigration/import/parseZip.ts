// src/lib/dataMigration/import/parseZip.ts

import "server-only";
import AdmZip from "adm-zip";
import type { ExportManifest } from "../export";

export type ParsedChunk = {
  chunkName: string;
  csvContent: string;
  assets: Map<string, Buffer>; // path -> buffer (e.g., "main_image/uuid.jpg" -> Buffer)
};

export type ParseZipResult = {
  success: true;
  manifest: ExportManifest;
  chunks: ParsedChunk[];
};

export type ParseZipError = {
  success: false;
  error: string;
  code: "INVALID_ZIP" | "MISSING_MANIFEST" | "INVALID_MANIFEST" | "DOMAIN_MISMATCH" | "NO_CHUNKS";
};

/**
 * マニフェストを検証
 */
function validateManifest(data: unknown): data is ExportManifest {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.version === "string" &&
    typeof obj.domain === "string" &&
    typeof obj.exportedAt === "string" &&
    typeof obj.totalRecords === "number" &&
    typeof obj.chunkCount === "number" &&
    Array.isArray(obj.fields)
  );
}

/**
 * ZIP ファイルを解析
 */
export function parseZip(
  zipBuffer: Buffer,
  expectedDomain: string
): ParseZipResult | ParseZipError {
  let zip: AdmZip;

  try {
    zip = new AdmZip(zipBuffer);
  } catch {
    return {
      success: false,
      error: "Invalid ZIP file",
      code: "INVALID_ZIP",
    };
  }

  // manifest.json を読み込み
  const manifestEntry = zip.getEntry("manifest.json");
  if (!manifestEntry) {
    return {
      success: false,
      error: "manifest.json not found in ZIP",
      code: "MISSING_MANIFEST",
    };
  }

  let manifest: ExportManifest;
  try {
    const manifestContent = manifestEntry.getData().toString("utf-8");
    const parsed = JSON.parse(manifestContent);
    if (!validateManifest(parsed)) {
      return {
        success: false,
        error: "Invalid manifest.json structure",
        code: "INVALID_MANIFEST",
      };
    }
    manifest = parsed;
  } catch {
    return {
      success: false,
      error: "Failed to parse manifest.json",
      code: "INVALID_MANIFEST",
    };
  }

  // ドメイン検証
  if (manifest.domain !== expectedDomain) {
    return {
      success: false,
      error: `Domain mismatch: expected "${expectedDomain}", got "${manifest.domain}"`,
      code: "DOMAIN_MISMATCH",
    };
  }

  // チャンクフォルダを列挙
  const entries = zip.getEntries();
  const chunkFolders = new Set<string>();

  for (const entry of entries) {
    const match = entry.entryName.match(/^(chunk_\d{3})\//);
    if (match) {
      chunkFolders.add(match[1]);
    }
  }

  if (chunkFolders.size === 0) {
    return {
      success: false,
      error: "No chunk folders found in ZIP",
      code: "NO_CHUNKS",
    };
  }

  // チャンクをソートして処理
  const sortedChunks = Array.from(chunkFolders).sort();
  const chunks: ParsedChunk[] = [];

  for (const chunkName of sortedChunks) {
    // data.csv を読み込み
    const csvEntry = zip.getEntry(`${chunkName}/data.csv`);
    if (!csvEntry) {
      console.warn(`[Import] ${chunkName}/data.csv not found, skipping chunk`);
      continue;
    }

    const csvContent = csvEntry.getData().toString("utf-8");

    // assets を読み込み
    const assets = new Map<string, Buffer>();
    const assetPrefix = `${chunkName}/assets/`;

    for (const entry of entries) {
      if (entry.entryName.startsWith(assetPrefix) && !entry.isDirectory) {
        // assets/ 以降のパスをキーにする (e.g., "main_image/uuid.jpg")
        const relativePath = entry.entryName.slice(assetPrefix.length);
        if (relativePath) {
          assets.set(relativePath, entry.getData());
        }
      }
    }

    chunks.push({
      chunkName,
      csvContent,
      assets,
    });
  }

  return {
    success: true,
    manifest,
    chunks,
  };
}
