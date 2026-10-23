// src/features/core/user/hooks/useAvatarUpload.ts
//
// アバター画像のアップロード（用途 user.avatar）。保存は useUpdateMyProfile で avatarUrl に ref を入れて行う
// （サーバーの storage binding が保存と同じ TX で台帳に紐付ける）。
// 保存に失敗したときは discard で未採用のファイルを取り消す（呼ばなくても掃除で消える）。

"use client";

import { useCallback } from "react";

import { storageClient, uploadToStorage, type UploadedFile } from "@/lib/storage/client";

export const AVATAR_STORAGE_PURPOSE = "user.avatar";

export type UseAvatarUploadReturn = {
  /** 画像をアップロードし、保存する ref と表示用 src を返す */
  upload: (file: File) => Promise<UploadedFile>;
  /** 保存しなかったファイルを取り消す（失敗はログだけ） */
  discard: (objectId: string) => Promise<void>;
};

export function useAvatarUpload(): UseAvatarUploadReturn {
  const upload = useCallback(
    (file: File) =>
      new Promise<UploadedFile>((resolve, reject) => {
        uploadToStorage(file, {
          purpose: AVATAR_STORAGE_PURPOSE,
          onComplete: resolve,
          onError: reject,
        });
      }),
    [],
  );

  const discard = useCallback(async (objectId: string) => {
    try {
      await storageClient.discard(objectId);
    } catch (error) {
      console.error("[useAvatarUpload] 取り消しに失敗しました（未採用のファイルは掃除で消えます）", error);
    }
  }, []);

  return { upload, discard };
}
