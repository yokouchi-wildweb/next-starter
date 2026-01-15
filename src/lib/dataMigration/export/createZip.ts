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
