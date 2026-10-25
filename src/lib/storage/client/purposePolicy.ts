// src/lib/storage/client/purposePolicy.ts
//
// 用途の方針（metadata: strip / keep）をサーバー（GET /api/storage/purposes/[purpose]）から得て、用途ごとに記憶する。
// 端末は用途の宣言を推測しない（登録表は server-only）。HEIC などを JPEG に変えるか（uploadToStorage）と、
// 写真選択の accept を受け付ける画像の型に狭めるか（usePurposeMetadata → pickerAcceptFor）をこの答えで決める。
// 記憶はページの寿命の間（用途表はデプロイ単位でしか変わらない）。取得に失敗したら記憶を消し、次の呼び出しで取り直す。

import type { StorageMetadataPolicy } from "../policy/types";
import { storageClient, type StorageClient } from "./storageClient";

export type PurposeMetadataLoader = {
  /** 用途の方針を返す（同じ用途の 2 回目以降は問い合わせない）。失敗は reject */
  load: (purpose: string) => Promise<StorageMetadataPolicy>;
  /** 既に得ている方針（まだなら undefined）。描画の初期値に使う */
  peek: (purpose: string) => StorageMetadataPolicy | undefined;
};

export function createPurposeMetadataLoader(client: Pick<StorageClient, "policy">): PurposeMetadataLoader {
  const pending = new Map<string, Promise<StorageMetadataPolicy>>();
  const known = new Map<string, StorageMetadataPolicy>();

  return {
    load(purpose) {
      const cached = pending.get(purpose);
      if (cached) return cached;
      const request = client.policy(purpose).then(
        ({ metadata }) => {
          known.set(purpose, metadata);
          return metadata;
        },
        (error: unknown) => {
          pending.delete(purpose);
          throw error;
        },
      );
      pending.set(purpose, request);
      return request;
    },
    peek: (purpose) => known.get(purpose),
  };
}

/** アプリ全体で共有する記憶（uploadToStorage と usePurposeMetadata が使う） */
export const purposeMetadataLoader: PurposeMetadataLoader = createPurposeMetadataLoader(storageClient);
