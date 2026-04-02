// src/lib/x/media.ts

import type { EUploadMimeType, TwitterApi, TUploadableMedia } from "twitter-api-v2";

import type { XMediaUploadOptions } from "./types";

/**
 * メディアをアップロードする。
 * ファイルパス、Buffer、fs.promises.FileHandle を受け付ける。
 *
 * @param client - 認証済み TwitterApi クライアント（OAuth 1.0a が必要）
 * @param file - アップロードするファイル（パス文字列、Buffer、FileHandle）
 * @param options - MIMEタイプ、カテゴリ、代替テキスト
 * @returns アップロード済みメディアID
 */
export async function uploadMedia(
  client: TwitterApi,
  file: TUploadableMedia,
  options?: XMediaUploadOptions,
): Promise<string> {
  const mediaId = await client.v1.uploadMedia(file, {
    mimeType: options?.mimeType as EUploadMimeType | undefined,
    target: "tweet",
  });

  if (options?.altText) {
    await client.v1.createMediaMetadata(mediaId, {
      alt_text: { text: options.altText },
    });
  }

  return mediaId;
}

/**
 * Buffer からメディアをアップロードする。
 * MIMEタイプの指定が必須。
 *
 * @param client - 認証済み TwitterApi クライアント
 * @param buffer - メディアデータの Buffer
 * @param mimeType - MIMEタイプ（例: "image/png", "video/mp4"）
 * @param options - 代替テキスト等
 */
export async function uploadMediaFromBuffer(
  client: TwitterApi,
  buffer: Buffer,
  mimeType: string,
  options?: Pick<XMediaUploadOptions, "altText">,
): Promise<string> {
  return uploadMedia(client, buffer, { ...options, mimeType });
}

/**
 * 複数メディアを一括アップロードする。
 *
 * @param client - 認証済み TwitterApi クライアント
 * @param files - アップロードするファイルの配列
 * @param options - 各ファイル共通のオプション
 * @returns アップロード済みメディアIDの配列
 */
export async function uploadMediaBatch(
  client: TwitterApi,
  files: TUploadableMedia[],
  options?: XMediaUploadOptions,
): Promise<string[]> {
  return Promise.all(files.map((file) => uploadMedia(client, file, options)));
}
