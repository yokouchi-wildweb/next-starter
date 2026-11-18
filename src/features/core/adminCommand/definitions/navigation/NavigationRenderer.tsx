// src/lib/adminCommand/definitions/navigation/NavigationRenderer.tsx

"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "@/lib/unsavedGuard";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/Primitives/Command";
import { cn } from "@/lib/cn";
import type { CategoryRendererProps } from "@/features/core/adminCommand/base/types";
import { useAdminCommand } from "@/features/core/adminCommand/base/context";
import { filterSearchInput } from "../../utils";
import { navigationItems } from "./items";

/**
 * ナビゲーションカテゴリのレンダラー
 */
export function NavigationRenderer({ onClose, onBack }: CategoryRendererProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  // 管理の枠の中では閉じた機能の住所の行を除く(AdminCommandGateBridge が登録)。外では絞らない(L2.4)
  const { navigationFilter } = useAdminCommand();
  const items = useMemo(() => (navigationFilter ? navigationFilter(navigationItems) : navigationItems), [navigationFilter]);

  // 検索入力のハンドラ（半角英数字のみに変換）
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(filterSearchInput(value));
  }, []);

  const handleNavigate = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

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

  return (
    <Command
      key="navigation"
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
          placeholder="ナビゲーション先を検索..."
          value={searchValue}
          onValueChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          inputMode="email"
          autoFocus
        />
      </Flex>
      <CommandList>
        <CommandEmpty>項目が見つかりません</CommandEmpty>
        <CommandGroup heading="ナビゲーション">
          {items.map((item) => (
            <CommandItem
              key={item.id}
              className={cn("group", item.className)}
              value={`${item.label} ${item.description ?? ""} ${item.keywords?.join(" ") ?? ""}`}
              onSelect={() => handleNavigate(item.href)}
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
