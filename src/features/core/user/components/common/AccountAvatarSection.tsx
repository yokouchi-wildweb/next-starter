// src/features/core/user/components/common/AccountAvatarSection.tsx
// 自己完結した部品(アバターの変更・削除)。流れは useAvatarChange(HTTP は useAvatarUpload / useUpdateMyProfile 経由、client service を直接呼ばない)

"use client";

import { type ReactNode, useCallback, useRef, useState } from "react";
import { CameraIcon, ImageIcon, Trash2Icon, UserIcon } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { Flex } from "@/components/Layout/Flex";
import { InBlock } from "@/components/Layout/InBlock";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { ActionPopover } from "@/components/Overlays/Popover";
import { Spinner } from "@/components/Overlays/Loading";
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
  /** アバター未設定時に丸の中に出す物（頭文字・別の絵など）。省略時は既定の人の形。
   * 丸の箱（size × size）は部品が持つ */
  children?: ReactNode;
};

// --- デフォルトフォールバック ---

function DefaultFallback({ size, children }: { size: number; children?: ReactNode }) {
  const iconSize = size * 0.45;
  return (
    <InBlock className="flex items-center justify-center rounded-full bg-primary/10" style={{ width: size, height: size }}>
      {children ?? (
        <UserIcon className="text-primary" style={{ width: iconSize, height: iconSize }} strokeWidth={1.5} />
      )}
    </InBlock>
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
  children,
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

  // 丸を押した時: 画像設定済み → メニュー(ActionPopover)を開く / 未設定 → メニューを出さずにファイル選択 / 処理中 → 何もしない
  const handleMenuOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setMenuOpen(false);
        return;
      }
      if (isBusy) return;
      if (currentAvatarUrl) setMenuOpen(true);
      else openFileSelector();
    },
    [isBusy, currentAvatarUrl, openFileSelector],
  );

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
    <Stack gap="2xs">
      <Flex direction="column" align="center" className="gap-2 py-2">
        {/* アバター */}
        <ActionPopover
          open={menuOpen}
          onOpenChange={handleMenuOpenChange}
          side="bottom"
          align="center"
          actions={[
            { label: "画像を変更", icon: ImageIcon, onClick: openFileSelector },
            { label: "画像を削除", icon: Trash2Icon, onClick: handleRemoveImage, variant: "destructive" },
          ]}
          trigger={
            <Button
              type="button"
              variant="none"
              size="none"
              iconSizing="none"
              propagateClick
              // Button の土台の transition・disabled の薄さと止めた矢印を生の button と同じに戻す(処理中も乗るとスピナーが出る)
              className="group relative cursor-pointer rounded-full transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-pointer disabled:opacity-100"
              disabled={isBusy}
              aria-label="アバター画像を変更"
            >
              {currentAvatarUrl ? (
                <InBlock className="block overflow-hidden rounded-full" style={{ width: size, height: size }}>
                  <AppImage
                    src={currentAvatarUrl}
                    alt={user.name ?? "アバター"}
                    sizes={`${size}px`}
                    className="h-full w-full"
                  />
                </InBlock>
              ) : (
                <DefaultFallback size={size}>{children}</DefaultFallback>
              )}

              {/* オーバーレイ */}
              <InBlock className="absolute inset-0 flex items-center justify-center rounded-full bg-overlay/0 transition-colors group-hover:bg-overlay/40">
                {isBusy ? (
                  <Spinner className="h-6 w-6 text-overlay-foreground opacity-0 group-hover:opacity-100" />
                ) : (
                  <CameraIcon className="h-6 w-6 text-overlay-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </InBlock>
            </Button>
          }
        />

        {/* ユーザー名 */}
        <Para className="my-0 text-base font-medium text-foreground">{user.name ?? "未設定"}</Para>

        {/* エラー表示 */}
        {error && <Para className="my-0 text-xs text-destructive-text">{error}</Para>}
      </Flex>

      {/* 非表示ファイル入力 */}
      <Input ref={fileInputRef} type="file" accept={acceptTypes} hidden onChange={handleFileChange} />
    </Stack>
  );
}
