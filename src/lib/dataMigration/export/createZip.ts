// src/lib/dataMigration/export/createZip.ts

import "server-only";
import archiver from "archiver";
import { PassThrough } from "stream";

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

/**
 * チャンク内の画像を並列ダウンロードし、レコードのURLをアセットパスに置換する
 * @param records チャンク内のレコード配列
 * @param imageFields 画像フィールド名のリスト
 * @param pathPrefix ZIP 内のパスプレフィックス（例: "chunk_001" or "domain/chunk_001"）
 * @returns 置換済みレコードと ZIP エントリ
 */
export async function downloadChunkImages(
  records: Record<string, unknown>[],
  imageFields: string[],
  pathPrefix: string,
): Promise<{ modifiedRecords: Record<string, unknown>[]; zipEntries: ZipEntry[] }> {
  type Task = { recordIndex: number; imageField: string; url: string; recordId: string };
  const tasks: Task[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const recordId = String(record.id || "unknown");
    for (const imageField of imageFields) {
      const imageUrl = record[imageField];
      if (typeof imageUrl === "string" && imageUrl.startsWith("http")) {
        tasks.push({ recordIndex: i, imageField, url: imageUrl, recordId });
      }
    }
  }

  if (tasks.length === 0) {
    return { modifiedRecords: records, zipEntries: [] };
  }

  const modifiedRecords = records.map((r) => ({ ...r }));
  const zipEntries: ZipEntry[] = [];
  const CONCURRENCY = 5;

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (task) => ({
        ...task,
        imageBuffer: await downloadImage(task.url),
      })),
    );

    for (const result of results) {
      if (result.imageBuffer) {
        const filename = extractFilename(result.url, result.recordId);
        const assetPath = `assets/${result.imageField}/${filename}`;
        zipEntries.push({
          path: `${pathPrefix}/${assetPath}`,
          content: result.imageBuffer,
        });
        modifiedRecords[result.recordIndex] = {
          ...modifiedRecords[result.recordIndex],
          [result.imageField]: assetPath,
        };
      }
    }
  }

  return { modifiedRecords, zipEntries };
}

/**
 * URL からファイル名を抽出
 * @param url 画像の URL
 * @param recordId レコード ID
 * @returns ファイル名（例: "xxx.png"）
 */
export function extractFilename(url: string, recordId: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = pathname.split(".").pop() || "bin";
    return `${recordId}.${ext}`;
  } catch {
    // URL パースに失敗した場合はレコード ID をそのまま使用
    return `${recordId}.bin`;
  }
}
