// src/features/core/user/components/common/AccountAvatarSection.tsx
// 自己完結した部品(アバターの変更・削除)。HTTP は useAvatarUpload / useUpdateMyProfile 経由(client service を直接呼ばない)

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraIcon, ImageIcon, LoaderIcon, Trash2Icon, UserIcon } from "lucide-react";

import { Stack } from "@/components/Layout/Stack";
import { AppImage } from "@/components/Media/AppImage";
import { useAvatarUpload } from "@/features/core/user/hooks/useAvatarUpload";
import { useUpdateMyProfile } from "@/features/core/user/hooks/useUpdateMyProfile";
import type { User } from "@/features/core/user/entities";

// --- 型定義 ---

type AccountAvatarSectionProps = {
  user: User;
  /**
   * @deprecated 使われない（保存先は用途 user.avatar で決まる）。互換のため受け取るだけ
   */
  storagePath?: string;
  /** アバターのサイズ（px） */
  size?: number;
  /** 許可するMIMEタイプ */
  acceptTypes?: string;
  /** 最大ファイルサイズ（バイト） */
  maxFileSize?: number;
  /** アップロード完了後のコールバック */
  onAvatarUpdated?: (user: User) => void;
  /** カスタムフォールバック（アバター未設定時の表示） */
  renderFallback?: (user: User, size: number) => React.ReactNode;
};

// --- デフォルトフォールバック ---

function DefaultFallback({ size }: { size: number }) {
  const iconSize = size * 0.45;
  return (
    <span
      className="flex items-center justify-center rounded-full bg-primary/10"
      style={{ width: size, height: size }}
    >
      <UserIcon
        className="text-primary"
        style={{ width: iconSize, height: iconSize }}
        strokeWidth={1.5}
      />
    </span>
  );
}

// --- アバターメニュー ---

type AvatarMenuProps = {
  onChangeImage: () => void;
  onRemoveImage: () => void;
  onClose: () => void;
};

function AvatarMenu({ onChangeImage, onRemoveImage, onClose }: AvatarMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute top-full left-1/2 z-50 mt-2 w-40 -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-popover shadow-md"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-popover-foreground transition-colors hover:bg-muted"
        onClick={() => {
          onChangeImage();
          onClose();
        }}
      >
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        画像を変更
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-destructive-text transition-colors hover:bg-muted"
        onClick={() => {
          onRemoveImage();
          onClose();
        }}
      >
        <Trash2Icon className="h-4 w-4" />
        画像を削除
      </button>
    </div>
  );
}

// --- メインコンポーネント ---

const DEFAULT_SIZE = 80;
const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function AccountAvatarSection({
  user,
  size = DEFAULT_SIZE,
  acceptTypes = DEFAULT_ACCEPT,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  onAvatarUpdated,
  renderFallback,
}: AccountAvatarSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // ローカルの error はファイル検証・アップロード失敗用。API 失敗は hook の error を併せて表示する
  const [error, setError] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(user.avatarUrl);
  const { updateProfile, error: updateError, reset: resetUpdateError } = useUpdateMyProfile();
  const { upload, discard } = useAvatarUpload();

  const lockRef = useRef(false);
  const isBusy = isUploading || isRemoving;

  const openFileSelector = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClick = useCallback(() => {
    if (isBusy) return;

    if (currentAvatarUrl) {
      // 画像設定済み → メニュー表示
      setMenuOpen((prev) => !prev);
    } else {
      // 画像未設定 → 直接ファイル選択
      openFileSelector();
    }
  }, [isBusy, currentAvatarUrl, openFileSelector]);

  const handleRemoveImage = useCallback(async () => {
    if (lockRef.current) return;
    lockRef.current = true;
    setError(null);
    resetUpdateError();
    setIsRemoving(true);

    try {
      // 失敗時は null が返り、hook の error にメッセージが入る
      const updatedUser = await updateProfile({
        name: user.name ?? "",
        avatarUrl: null,
      });
      if (updatedUser) {
        setCurrentAvatarUrl(null);
        onAvatarUpdated?.(updatedUser);
      }
    } finally {
      lockRef.current = false;
      setIsRemoving(false);
    }
  }, [user.name, onAvatarUpdated, updateProfile, resetUpdateError]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // input をリセット（同じファイルを再選択可能にする）
      e.target.value = "";

      // バリデーション
      if (!acceptTypes.split(",").some((type) => file.type === type.trim())) {
        setError("対応していないファイル形式です");
        return;
      }
      if (file.size > maxFileSize) {
        const maxMB = Math.round(maxFileSize / 1024 / 1024);
        setError(`ファイルサイズは${maxMB}MB以下にしてください`);
        return;
      }

      setError(null);
      resetUpdateError();
      setIsUploading(true);

      void (async () => {
        try {
          const uploaded = await upload(file);
          // 失敗時は null が返り、hook の error にメッセージが入る
          const updatedUser = await updateProfile({
            name: user.name ?? "",
            avatarUrl: uploaded.ref,
          });
          if (updatedUser) {
            setCurrentAvatarUrl(uploaded.ref);
            onAvatarUpdated?.(updatedUser);
          } else {
            await discard(uploaded.objectId);
          }
        } catch (err) {
          setError((err instanceof Error && err.message) || "アップロードに失敗しました");
        } finally {
          setIsUploading(false);
        }
      })();
    },
    [acceptTypes, maxFileSize, user.name, onAvatarUpdated, updateProfile, resetUpdateError, upload, discard],
  );

  return (
    <Stack space={1}>
      <div className="flex flex-col items-center gap-2 py-2">
        {/* アバター */}
        <div className="relative">
          <button
            type="button"
            className="group relative cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={handleClick}
            disabled={isBusy}
            aria-label="アバター画像を変更"
          >
            {currentAvatarUrl ? (
              <span className="block overflow-hidden rounded-full" style={{ width: size, height: size }}>
                <AppImage
                  src={currentAvatarUrl}
                  alt={user.name ?? "アバター"}
                  sizes={`${size}px`}
                  className="h-full w-full"
                />
              </span>
            ) : renderFallback ? (
              renderFallback(user, size)
            ) : (
              <DefaultFallback size={size} />
            )}

            {/* オーバーレイ */}
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-overlay/0 transition-colors group-hover:bg-overlay/40">
              {isBusy ? (
                <LoaderIcon className="h-6 w-6 animate-spin text-overlay-foreground opacity-0 group-hover:opacity-100" />
              ) : (
                <CameraIcon className="h-6 w-6 text-overlay-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </span>
          </button>

          {/* メニュー */}
          {menuOpen && (
            <AvatarMenu
              onChangeImage={openFileSelector}
              onRemoveImage={handleRemoveImage}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>

        {/* ユーザー名 */}
        <p className="text-base font-medium text-foreground">
          {user.name ?? "未設定"}
        </p>

        {/* エラー表示 */}
        {(error ?? updateError) && (
          <p className="text-xs text-destructive-text">{error ?? updateError}</p>
        )}
      </div>

      {/* 非表示ファイル入力 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        className="hidden"
        onChange={handleFileChange}
      />
    </Stack>
  );
}
