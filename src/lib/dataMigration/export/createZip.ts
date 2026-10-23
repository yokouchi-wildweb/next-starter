// src/lib/dataMigration/export/createZip.ts

import "server-only";
import archiver from "archiver";
import { PassThrough } from "stream";
import { parseStorageRef } from "@/lib/storage";
import { MEDIA_SKIPPED_EXAMPLE_LIMIT, type MediaSkipped } from "../media";

export type ZipEntry = {
  /** ZIP 内のパス（例: "data.csv", "assets/main_image/xxx.png"） */
  path: string;
  /** ファイルの内容 */
  content: Buffer;
};

/**
 * ZIP アーカイブを作成
 * @param entries ZIP に含めるファイルのリスト
 * @returns ZIP ファイルの Buffer
 */
export async function createZip(entries: ZipEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();

    passThrough.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    passThrough.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    passThrough.on("error", reject);

    const archive = archiver("zip", {
      zlib: { level: 9 }, // 最大圧縮
    });

    archive.on("error", reject);
    archive.pipe(passThrough);

    // エントリを追加
    for (const entry of entries) {
      archive.append(entry.content, { name: entry.path });
    }

    archive.finalize();
  });
}

/**
 * URL から画像をダウンロードして Buffer を取得
 * @param url 画像の URL
 * @returns 画像の Buffer、失敗時は null
 */
export async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to download image: ${url} (${response.status})`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn(`Failed to download image: ${url}`, error);
    return null;
  }
}

/** export するメディア列（サービスの storageFields。multi = 値が配列） */
export type ExportMediaField = { name: string; multi: boolean };

export type DownloadChunkMediaOptions = {
  /** skipped の例に出すドメイン名 */
  domain: string;
  /**
   * 値を取得用の URL にする。http(s) の値はそのまま、ref は DataMigrationMediaResolver.resolveExportUrl で解決する。
   * 取得できない値（権限なし・解釈できない値など）は null
   */
  resolveUrl: (value: string) => Promise<string | null>;
};

/**
 * チャンク内のメディアを並列ダウンロードし、レコードの値を ZIP 内のパス（assets/<列>/<ファイル名>）に置換する。
 * - 単一列は `<レコード ID>.<拡張子>`、multi は `<レコード ID>_<n>.<拡張子>`（n は 1 始まり）
 * - 取得できなかった値は元の値（ref / URL）のまま CSV に残し、skipped に数える（黙って成功にしない）
 * @param pathPrefix ZIP 内のパスプレフィックス（例: "chunk_001" or "domain/chunk_001"）
 */
export async function downloadChunkMedia(
  records: Record<string, unknown>[],
  mediaFields: readonly ExportMediaField[],
  pathPrefix: string,
  options: DownloadChunkMediaOptions,
): Promise<{ modifiedRecords: Record<string, unknown>[]; zipEntries: ZipEntry[]; skipped: MediaSkipped }> {
  type Task = { recordIndex: number; field: ExportMediaField; itemIndex: number; value: string; recordId: string };
  const tasks: Task[] = [];
  const skipped: MediaSkipped = { count: 0, examples: [] };
  const skip = (task: Task) => {
    skipped.count++;
    if (skipped.examples.length < MEDIA_SKIPPED_EXAMPLE_LIMIT) {
      const item = task.field.multi ? `[${task.itemIndex + 1}]` : "";
      skipped.examples.push(`${options.domain}/${task.recordId}/${task.field.name}${item}`);
    }
  };

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const recordId = String(record.id || "unknown");
    for (const field of mediaFields) {
      const raw = record[field.name];
      const values = field.multi ? (Array.isArray(raw) ? raw : []) : [raw];
      values.forEach((value, itemIndex) => {
        if (typeof value === "string" && value.trim() !== "") {
          tasks.push({ recordIndex: i, field, itemIndex, value: value.trim(), recordId });
        }
      });
    }
  }

  const modifiedRecords = records.map((r) => ({ ...r }));
  for (const field of mediaFields) {
    if (!field.multi) continue;
    for (const record of modifiedRecords) {
      if (Array.isArray(record[field.name])) record[field.name] = [...(record[field.name] as unknown[])];
    }
  }
  const zipEntries: ZipEntry[] = [];
  const CONCURRENCY = 5;

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (task) => {
        const url = await options.resolveUrl(task.value);
        return { task, url, buffer: url ? await downloadImage(url) : null };
      }),
    );

    for (const { task, url, buffer } of results) {
      if (!url || !buffer) {
        skip(task);
        continue;
      }
      const ext = extensionOf(task.value, url);
      const filename = task.field.multi ? `${task.recordId}_${task.itemIndex + 1}.${ext}` : `${task.recordId}.${ext}`;
      const assetPath = `assets/${task.field.name}/${filename}`;
      zipEntries.push({ path: `${pathPrefix}/${assetPath}`, content: buffer });
      const record = modifiedRecords[task.recordIndex];
      if (task.field.multi) (record[task.field.name] as unknown[])[task.itemIndex] = assetPath;
      else record[task.field.name] = assetPath;
    }
  }

  return { modifiedRecords, zipEntries, skipped };
}

/** 拡張子: ref はその拡張子、URL はパスの末尾から（取れなければ bin） */
function extensionOf(value: string, url: string): string {
  const ref = parseStorageRef(value);
  if (ref) return ref.ext;
  try {
    const last = new URL(url).pathname.split("/").pop() ?? "";
    const dot = last.lastIndexOf(".");
    const ext = dot >= 0 ? last.slice(dot + 1) : "";
    return /^[A-Za-z0-9]{1,8}$/.test(ext) ? ext.toLowerCase() : "bin";
  } catch {
    return "bin";
  }
}

/** 複数の skipped を合わせる（例は先頭から MEDIA_SKIPPED_EXAMPLE_LIMIT 件） */
export function mergeMediaSkipped(target: MediaSkipped, source: MediaSkipped): void {
  target.count += source.count;
  for (const example of source.examples) {
    if (target.examples.length >= MEDIA_SKIPPED_EXAMPLE_LIMIT) break;
    target.examples.push(example);
  }
}
