// src/lib/storage/client/purposePolicy.ts
//
// 用途の方針（metadata: strip / keep と画像の縮小の指定 image）をサーバー（GET /api/storage/purposes/[purpose]）から得て、用途ごとに記憶する。
// 端末は用途の宣言を推測しない（登録表は server-only）。HEIC などを JPEG に変えるか（uploadToStorage）と、
// 写真選択の accept を受け付ける画像の型に狭めるか（usePurposeMetadata → pickerAcceptFor）、送る前に縮めるか（shrinkImageForPurpose）をこの答えで決める。
// 記憶はページの寿命の間（用途表はデプロイ単位でしか変わらない）。取得に失敗したら記憶を消し、次の呼び出しで取り直す。

import type { StorageMetadataPolicy } from "../policy/types";
import { storageClient, type StorageClient } from "./storageClient";
import type { PurposePolicyResponse } from "./transferTypes";

/** 用途の方針の全体（metadata と画像の縮小の指定 image | null） */
export type PurposePolicy = PurposePolicyResponse;

export type PurposeMetadataLoader = {
  /** 用途の方針の metadata を返す（同じ用途の 2 回目以降は問い合わせない）。失敗は reject */
  load: (purpose: string) => Promise<StorageMetadataPolicy>;
  /** 既に得ている metadata（まだなら undefined）。描画の初期値に使う */
  peek: (purpose: string) => StorageMetadataPolicy | undefined;
  /** 用途の方針の全体を返す（load と同じ 1 回の取得を共有する）。失敗は reject */
  loadPolicy: (purpose: string) => Promise<PurposePolicy>;
  /** 既に得ている方針の全体（まだなら undefined） */
  peekPolicy: (purpose: string) => PurposePolicy | undefined;
};

export function createPurposeMetadataLoader(client: Pick<StorageClient, "policy">): PurposeMetadataLoader {
  const pending = new Map<string, Promise<PurposePolicy>>();
  const known = new Map<string, PurposePolicy>();

  const loadPolicy = (purpose: string): Promise<PurposePolicy> => {
    const cached = pending.get(purpose);
    if (cached) return cached;
    const request = client.policy(purpose).then(
      (policy) => {
        const value: PurposePolicy = { metadata: policy.metadata, image: policy.image ?? null };
        known.set(purpose, value);
        return value;
      },
      (error: unknown) => {
        pending.delete(purpose);
        throw error;
      },
    );
    pending.set(purpose, request);
    return request;
  };

  return {
    load: (purpose) => loadPolicy(purpose).then((policy) => policy.metadata),
    peek: (purpose) => known.get(purpose)?.metadata,
    loadPolicy,
    peekPolicy: (purpose) => known.get(purpose),
  };
}

/** アプリ全体で共有する記憶（uploadToStorage・usePurposeMetadata・shrinkImageForPurpose が使う） */
export const purposeMetadataLoader: PurposeMetadataLoader = createPurposeMetadataLoader(storageClient);
