// src/features/core/user/components/UserMyPage/AccountAvatarSection.tsx

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraIcon, ImageIcon, LoaderIcon, Trash2Icon, UserIcon } from "lucide-react";

import { Stack } from "@/components/Layout/Stack";
import { clientUploader } from "@/lib/storage/client/clientUploader";
import { normalizeHttpError } from "@/lib/errors";
import { userClient } from "@/features/core/user/services/client/userClient";
import type { User } from "@/features/core/user/entities";

// --- 型定義 ---

type AccountAvatarSectionProps = {
  user: User;
  /** アバター画像の保存先パス（Firebase Storage） */
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
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-muted"
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

const DEFAULT_STORAGE_PATH = "avatars";
const DEFAULT_SIZE = 80;
const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function AccountAvatarSection({
  user,
  storagePath = DEFAULT_STORAGE_PATH,
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
  const [error, setError] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(user.avatarUrl);

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
    setError(null);
    setIsRemoving(true);

    try {
      const updatedUser = await userClient.updateMyProfile({
        name: user.name ?? "",
        avatarUrl: null,
      });
      setCurrentAvatarUrl(null);
      onAvatarUpdated?.(updatedUser);
    } catch (err) {
      const normalized = normalizeHttpError(err);
      setError(normalized.message);
    } finally {
      setIsRemoving(false);
    }
  }, [user.name, onAvatarUpdated]);

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
      setIsUploading(true);

      clientUploader.upload(file, {
        basePath: storagePath,
        onComplete: async ({ url }) => {
          try {
            const updatedUser = await userClient.updateMyProfile({
              name: user.name ?? "",
              avatarUrl: url,
            });
            setCurrentAvatarUrl(url);
            onAvatarUpdated?.(updatedUser);
          } catch (err) {
            const normalized = normalizeHttpError(err);
            setError(normalized.message);
          } finally {
            setIsUploading(false);
          }
        },
        onError: (err) => {
          setError(err.message || "アップロードに失敗しました");
          setIsUploading(false);
        },
      });
    },
    [acceptTypes, maxFileSize, storagePath, user.name, onAvatarUpdated],
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
              <img
                src={currentAvatarUrl}
                alt={user.name ?? "アバター"}
                className="rounded-full object-cover"
                style={{ width: size, height: size }}
              />
            ) : renderFallback ? (
              renderFallback(user, size)
            ) : (
              <DefaultFallback size={size} />
            )}

            {/* オーバーレイ */}
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors group-hover:bg-black/40">
              {isBusy ? (
                <LoaderIcon className="h-6 w-6 animate-spin text-white opacity-0 group-hover:opacity-100" />
              ) : (
                <CameraIcon className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
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
        {error && (
          <p className="text-xs text-destructive">{error}</p>
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
