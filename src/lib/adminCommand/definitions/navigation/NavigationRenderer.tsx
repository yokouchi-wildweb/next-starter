// src/lib/adminCommand/definitions/navigation/NavigationRenderer.tsx

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/_shadcn/command";
import type { CategoryRendererProps } from "../../core/types";
import { filterSearchInput } from "../../utils";
import { navigationItems } from "./items";

/**
 * ナビゲーションカテゴリのレンダラー
 */
export function NavigationRenderer({ onClose, onBack }: CategoryRendererProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");

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

  // 検索入力が空の時に Backspace で戻る
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && searchValue === "") {
        e.preventDefault();
        onBack();
      }
    },
    [searchValue, onBack]
  );

  return (
    <Command
      key="navigation"
      className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
    >
      <div className="flex items-center gap-2 border-b">
        <button
          type="button"
          onClick={onBack}
          className="p-1 ml-2 hover:bg-accent rounded"
        >
          <ArrowLeftIcon className="size-4" />
        </button>
        <CommandInput
          placeholder="ナビゲーション先を検索..."
          value={searchValue}
          onValueChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          inputMode="email"
          autoFocus
        />
      </div>
      <CommandList>
        <CommandEmpty>項目が見つかりません</CommandEmpty>
        <CommandGroup heading="ナビゲーション">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.id}
              className="group"
              value={`${item.label} ${item.description ?? ""} ${item.keywords?.join(" ") ?? ""}`}
              onSelect={() => handleNavigate(item.href)}
            >
              {item.icon && <span className="mr-2">{item.icon}</span>}
              <span>{item.label}</span>
              {item.description && (
                <span className="ml-2 text-muted-foreground text-xs group-data-[selected=true]:text-accent-foreground">
                  {item.description}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
