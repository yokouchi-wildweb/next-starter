// src/lib/adminCommand/core/AdminCommandPalette.tsx

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRightIcon } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/_shadcn/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/Overlays/Dialog";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { categories } from "../config/categories";
import { filterSearchInput } from "../utils";
import type { PaletteView } from "./types";

type AdminCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AdminCommandPalette({ open, onOpenChange }: AdminCommandPaletteProps) {
  const { user } = useAuthSession();
  const [view, setView] = useState<PaletteView>({ type: "root" });
  const [searchValue, setSearchValue] = useState("");

  // ダイアログが閉じたら状態をリセット
  useEffect(() => {
    if (!open) {
      setView({ type: "root" });
      setSearchValue("");
    }
  }, [open]);

  // 検索入力のハンドラ（半角英数字のみに変換）
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(filterSearchInput(value));
  }, []);

  const closePalette = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const goBack = useCallback(() => {
    setView({ type: "root" });
  }, []);

  const handleCategorySelect = useCallback((categoryId: string) => {
    setView({ type: "category", categoryId });
  }, []);

  // 現在選択中のカテゴリを取得
  const selectedCategory = useMemo(() => {
    if (view.type !== "category") return null;
    return categories.find((c) => c.id === view.categoryId) ?? null;
  }, [view]);

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden p-0"
        showCloseButton={false}
        layer="super"
        overlayLayer="super"
      >
        <DialogTitle srOnly>管理者コマンド</DialogTitle>

        {/* ルート: カテゴリ一覧 */}
        {view.type === "root" && (
          <Command
            key="root"
            className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          >
            <div className="flex items-center gap-2 border-b">
              <CommandInput
                placeholder="コマンドを検索..."
                value={searchValue}
                onValueChange={handleSearchChange}
                inputMode="email"
                autoFocus
              />
            </div>
            <CommandList>
              <CommandEmpty>項目が見つかりません</CommandEmpty>
              <CommandGroup heading="カテゴリ">
                {categories.map((category) => (
                  <CommandItem
                    key={category.id}
                    className="group"
                    value={`${category.label} ${category.description ?? ""}`}
                    onSelect={() => handleCategorySelect(category.id)}
                  >
                    {category.icon && <span className="mr-2">{category.icon}</span>}
                    <span>{category.label}</span>
                    {category.description && (
                      <span className="ml-2 text-muted-foreground text-xs group-data-[selected=true]:text-accent-foreground">
                        {category.description}
                      </span>
                    )}
                    <ChevronRightIcon className="ml-auto size-4 text-muted-foreground group-data-[selected=true]:text-accent-foreground" />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}

        {/* カテゴリ選択後: カスタムレンダラーを表示 */}
        {view.type === "category" && selectedCategory && (
          <selectedCategory.Renderer
            onClose={closePalette}
            onBack={goBack}
            user={user}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
