// src/features/core/adminCommand/definitions/session/SessionRenderer.tsx

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "@/lib/unsavedGuard";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks";
import { InlineLoader } from "@/components/Overlays/Loading/InlineLoader";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/Primitives/Command";
import type { CategoryRendererProps } from "@/features/core/adminCommand/base/types";
import { useLogout } from "@/features/core/auth/hooks/useLogout";
import { useSessionRefresh } from "@/features/core/auth/hooks/useSessionRefresh";
import { useToast } from "@/lib/toast";
import { filterSearchInput } from "../../utils";
import { sessionItems } from "./items";

type ProcessingState = {
  type: "idle" | "refresh" | "logout";
  message?: string;
};

/**
 * セッション管理カテゴリのレンダラー
 */
export function SessionRenderer({ onClose, onBack }: CategoryRendererProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [processing, setProcessing] = useState<ProcessingState>({ type: "idle" });

  const { logout } = useLogout({ redirectTo: "/" });
  const { refresh } = useSessionRefresh();
  const { showToast } = useToast();

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(filterSearchInput(value));
  }, []);

  // キーボード操作
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 検索入力が空の時に Backspace または ArrowLeft で戻る
      if ((e.key === "Backspace" || e.key === "ArrowLeft") && searchValue === "") {
        e.preventDefault();
        onBack();
        return;
      }
      // ArrowRight で選択中の項目を実行（Enterと同じ動作）
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const selected = document.querySelector<HTMLElement>("[cmdk-item][data-selected='true']");
        selected?.click();
      }
    },
    [searchValue, onBack]
  );

  const handleSelect = useCallback(
    async (itemId: string) => {
      if (itemId === "session-refresh") {
        setProcessing({ type: "refresh", message: "リフレッシュ中..." });
        try {
          await refresh();
          onClose();
          showToast({ message: "セッションをリフレッシュしました", variant: "success", position: "center" });
          router.refresh();
        } catch {
          onClose();
          showToast({ message: "セッションのリフレッシュに失敗しました", variant: "error", position: "center" });
        }
      } else if (itemId === "session-logout") {
        setProcessing({ type: "logout", message: "ログアウト中..." });
        try {
          await logout();
          onClose();
        } catch {
          onClose();
        }
      }
    },
    [refresh, logout, onClose, router, showToast]
  );

  // 処理中はローディング表示
  if (processing.type !== "idle") {
    return (
      <Command className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
        <CommandList>
          <InlineLoader message={processing.message} />
        </CommandList>
      </Command>
    );
  }

  return (
    <Command
      key="session"
      className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
    >
      <Flex align="center" gap="xs" className="border-b">
        <Button
          type="button"
          variant="none"
          size="none"
          propagateClick
          onClick={onBack}
          className="p-1 ml-2 hover:bg-accent rounded"
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <CommandInput
          placeholder="セッション操作を検索..."
          value={searchValue}
          onValueChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          inputMode="email"
          autoFocus
        />
      </Flex>
      <CommandList>
        <CommandEmpty>項目が見つかりません</CommandEmpty>
        <CommandGroup heading="セッション管理">
          {sessionItems.map((item) => (
            <CommandItem
              key={item.id}
              className="group"
              value={`${item.label} ${item.description ?? ""} ${item.keywords?.join(" ") ?? ""}`}
              onSelect={() => handleSelect(item.id)}
            >
              {item.icon && <Span inline className="mr-2">{item.icon}</Span>}
              <Span inline>{item.label}</Span>
              {item.description && (
                <Span
                size="xs"
                weight="inherit"
                tone="muted"
                className="ml-2 group-data-[selected=true]:text-accent-foreground"
              >
                  {item.description}
                </Span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
