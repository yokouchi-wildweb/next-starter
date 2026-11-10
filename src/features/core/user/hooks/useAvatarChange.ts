// src/features/core/user/hooks/useAvatarChange.ts
//
// 自分のアバターの変更・削除の流れ(検査 → アップロード → プロフィールに保存 → 保存に失敗したら取り消し)。
// 見た目を持たない: AccountAvatarSection も fork の自前の見た目も、これを呼んで好きに描く。
// 用途は user.avatar(位置情報などのメタデータは常に strip、受け付ける型は STRIP_IMAGE_TYPES)。
// 低い層の useAvatarUpload / useUpdateMyProfile はそのまま公開。契約表: src/features/core/user/README.md「アバターの変更」

"use client";

import { useCallback, useRef, useState } from "react";

import { STRIP_IMAGE_TYPES } from "@/lib/storage";
import type { User } from "@/features/core/user/entities";
import { useAvatarUpload } from "@/features/core/user/hooks/useAvatarUpload";
import { useUpdateMyProfile } from "@/features/core/user/hooks/useUpdateMyProfile";

/** 既定で受け付ける画像の型(user.avatar = strip の型。具体型の列挙なので iOS は HEIC を JPEG にして渡す) */
export const DEFAULT_AVATAR_ACCEPT_TYPES = STRIP_IMAGE_TYPES.join(",");
/** 既定の最大ファイルサイズ(5MB。用途 user.avatar の上限 5MiB と同じ) */
export const DEFAULT_AVATAR_MAX_FILE_SIZE = 5 * 1024 * 1024;

export type UseAvatarChangeOptions = {
  /** 今の利用者(avatarUrl の初期値、保存に送る name) */
  user: User;
  /** 受け付ける MIME 型(カンマ区切り、file input の accept にもそのまま渡せる) */
  acceptTypes?: string;
  /** 最大ファイルサイズ(バイト) */
  maxFileSize?: number;
  /** 変更・削除の保存が済んだ後(保存後の利用者) */
  onAvatarUpdated?: (user: User) => void;
};

export type UseAvatarChangeReturn = {
  /** 今のアバターの ref(保存が済むと変わる。未設定 = null) */
  avatarUrl: string | null;
  /** 検査だけ(状態を変えない)。だめなら文言、良ければ null */
  validate: (file: File) => string | null;
  /** 検査 → アップロード → 保存。保存まで済めば true。処理中の呼び出しは何もせず false */
  change: (file: File) => Promise<boolean>;
  /** アバターを外して保存。済めば true。処理中の呼び出しは何もせず false */
  remove: () => Promise<boolean>;
  isUploading: boolean;
  isRemoving: boolean;
  isBusy: boolean;
  /** 検査・アップロードの失敗、または保存の失敗の文言 */
  error: string | null;
  clearError: () => void;
  acceptTypes: string;
  maxFileSize: number;
};

export function useAvatarChange({
  user,
  acceptTypes = DEFAULT_AVATAR_ACCEPT_TYPES,
  maxFileSize = DEFAULT_AVATAR_MAX_FILE_SIZE,
  onAvatarUpdated,
}: UseAvatarChangeOptions): UseAvatarChangeReturn {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl ?? null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  // ローカルの error は検査・アップロードの失敗。保存の失敗は useUpdateMyProfile の error を併せて返す
  const [localError, setLocalError] = useState<string | null>(null);
  const { updateProfile, error: updateError, reset: resetUpdateError } = useUpdateMyProfile();
  const { upload, discard } = useAvatarUpload();
  // 変更と削除で 1 つの鍵(state の反映を待たずに二重の呼び出しを止める)
  const lockRef = useRef(false);

  const validate = useCallback(
    (file: File): string | null => {
      if (!acceptTypes.split(",").some((type) => file.type === type.trim())) {
        return "対応していないファイル形式です";
      }
      if (file.size > maxFileSize) {
        const maxMB = Math.round(maxFileSize / 1024 / 1024);
        return `ファイルサイズは${maxMB}MB以下にしてください`;
      }
      return null;
    },
    [acceptTypes, maxFileSize],
  );

  const clearError = useCallback(() => {
    setLocalError(null);
    resetUpdateError();
  }, [resetUpdateError]);

  const change = useCallback(
    async (file: File): Promise<boolean> => {
      if (lockRef.current) return false;
      const invalid = validate(file);
      if (invalid) {
        setLocalError(invalid);
        return false;
      }
      lockRef.current = true;
      clearError();
      setIsUploading(true);
      try {
        const uploaded = await upload(file);
        // 失敗時は null が返り、useUpdateMyProfile の error にメッセージが入る
        const updatedUser = await updateProfile({ name: user.name ?? "", avatarUrl: uploaded.ref });
        if (!updatedUser) {
          await discard(uploaded.objectId);
          return false;
        }
        setAvatarUrl(uploaded.ref);
        onAvatarUpdated?.(updatedUser);
        return true;
      } catch (err) {
        setLocalError((err instanceof Error && err.message) || "アップロードに失敗しました");
        return false;
      } finally {
        lockRef.current = false;
        setIsUploading(false);
      }
    },
    [validate, clearError, upload, updateProfile, discard, user.name, onAvatarUpdated],
  );

  const remove = useCallback(async (): Promise<boolean> => {
    if (lockRef.current) return false;
    lockRef.current = true;
    clearError();
    setIsRemoving(true);
    try {
      const updatedUser = await updateProfile({ name: user.name ?? "", avatarUrl: null });
      if (!updatedUser) return false;
      setAvatarUrl(null);
      onAvatarUpdated?.(updatedUser);
      return true;
    } finally {
      lockRef.current = false;
      setIsRemoving(false);
    }
  }, [clearError, updateProfile, user.name, onAvatarUpdated]);

  return {
    avatarUrl,
    validate,
    change,
    remove,
    isUploading,
    isRemoving,
    isBusy: isUploading || isRemoving,
    error: localError ?? updateError,
    clearError,
    acceptTypes,
    maxFileSize,
  };
}
