// src/features/core/user/components/common/AccountAvatarSection.tsx
// 自己完結した部品(アバターの変更・削除)。流れは useAvatarChange(HTTP は useAvatarUpload / useUpdateMyProfile 経由、client service を直接呼ばない)

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraIcon, ImageIcon, LoaderIcon, Trash2Icon, UserIcon } from "lucide-react";

import { Stack } from "@/components/Layout/Stack";
import { AppImage } from "@/components/Media/AppImage";
import {
  DEFAULT_AVATAR_ACCEPT_TYPES,
  DEFAULT_AVATAR_MAX_FILE_SIZE,
  useAvatarChange,
} from "@/features/core/user/hooks/useAvatarChange";
import type { User } from "@/features/core/user/entities";

// --- 型定義 ---

type AccountAvatarSectionProps = {
  user: User;
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

export function AccountAvatarSection({
  user,
  size = DEFAULT_SIZE,
  acceptTypes = DEFAULT_AVATAR_ACCEPT_TYPES,
  maxFileSize = DEFAULT_AVATAR_MAX_FILE_SIZE,
  onAvatarUpdated,
  renderFallback,
}: AccountAvatarSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // 変更・削除の流れ(検査・アップロード・保存・取り消し・鍵・エラー)は hook が持つ
  const {
    avatarUrl: currentAvatarUrl,
    change,
    remove,
    isBusy,
    error,
  } = useAvatarChange({ user, acceptTypes, maxFileSize, onAvatarUpdated });

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

  const handleRemoveImage = useCallback(() => {
    void remove();
  }, [remove]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // input をリセット（同じファイルを再選択可能にする）
      e.target.value = "";

      void change(file);
    },
    [change],
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
        {error && (
          <p className="text-xs text-destructive-text">{error}</p>
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
