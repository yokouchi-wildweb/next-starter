// src/lib/adminCommand/definitions/settings/SettingsRenderer.tsx

"use client";

import { useCallback, useState } from "react";
import { ArrowLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { useToast } from "@/lib/toast";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/_shadcn/command";
import { useSetting } from "@/features/setting/hooks/useSetting";
import { useUpdateSetting } from "@/features/setting/hooks/useUpdateSetting";
import type { Setting } from "@/features/setting/entities";
import type { CategoryRendererProps } from "@/features/core/adminCommand/base/types";
import type { SettingFieldConfig } from "../../types";
import { filterSearchInput } from "../../utils";
import { settingFields } from "./items";

type ViewState =
  | { type: "list" }
  | { type: "input"; field: SettingFieldConfig };

/**
 * 設定変更カテゴリのレンダラー
 */
export function SettingsRenderer({ onClose, onBack }: CategoryRendererProps) {
  const { showToast } = useToast();
  const { data: setting, mutate: mutateSetting } = useSetting();
  const { trigger: updateSetting, isMutating } = useUpdateSetting();

  const [view, setView] = useState<ViewState>({ type: "list" });
  const [inputValue, setInputValue] = useState("");
  const [searchValue, setSearchValue] = useState("");

  // 検索入力のハンドラ（半角英数字のみに変換）
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(filterSearchInput(value));
  }, []);

  // 設定項目の現在値を取得
  const getCurrentValue = useCallback(
    (key: string): string => {
      if (!setting) return "";
      const value = setting[key as keyof Setting];
      return value?.toString() ?? "";
    },
    [setting]
  );

  // 設定項目選択 → 入力モードへ
  const handleFieldSelect = useCallback(
    (field: SettingFieldConfig) => {
      setView({ type: "input", field });
      if (setting) {
        const currentValue = setting[field.key as keyof Setting];
        setInputValue(currentValue?.toString() ?? "");
      }
    },
    [setting]
  );

  // リストに戻る
  const handleBackToList = useCallback(() => {
    setView({ type: "list" });
    setInputValue("");
  }, []);

  // 設定値の保存
  const handleSave = useCallback(async () => {
    if (view.type !== "input" || !setting) return;

    const { field } = view;
    const trimmedValue = inputValue.trim();

    // バリデーション
    if (field.type === "number") {
      const numValue = Number(trimmedValue);
      if (Number.isNaN(numValue)) {
        showToast({ message: "数値を入力してください", variant: "error", position: "center", layer: "apex" });
        return;
      }
      if (field.validation?.min !== undefined && numValue < field.validation.min) {
        showToast({ message: `${field.validation.min}以上の値を入力してください`, variant: "error", position: "center", layer: "apex" });
        return;
      }
      if (field.validation?.max !== undefined && numValue > field.validation.max) {
        showToast({ message: `${field.validation.max}以下の値を入力してください`, variant: "error", position: "center", layer: "apex" });
        return;
      }
    } else {
      if (field.validation?.minLength !== undefined && trimmedValue.length < field.validation.minLength) {
        showToast({ message: `${field.validation.minLength}文字以上入力してください`, variant: "error", position: "center", layer: "apex" });
        return;
      }
      if (field.validation?.maxLength !== undefined && trimmedValue.length > field.validation.maxLength) {
        showToast({ message: `${field.validation.maxLength}文字以内で入力してください`, variant: "error", position: "center", layer: "apex" });
        return;
      }
    }

    try {
      const updateValue = field.type === "number" ? Number(trimmedValue) : trimmedValue;
      await updateSetting({
        id: "global",
        data: {
          [field.key]: updateValue,
        } as Parameters<typeof updateSetting>[0]["data"],
      });
      showToast({ message: `${field.label}を更新しました`, variant: "success", position: "center", layer: "apex" });
      onClose();
      mutateSetting();
    } catch {
      showToast({ message: "設定の更新に失敗しました", variant: "error", position: "center", layer: "apex" });
    }
  }, [view, inputValue, setting, updateSetting, mutateSetting, onClose, showToast]);

  // 入力モードでのキーハンドリング
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (view.type !== "input") return;

      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleBackToList();
      }
    },
    [view, handleSave, handleBackToList]
  );

  // リストモードでのキーハンドリング
  const handleListKeyDown = useCallback(
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

  // 入力モード
  if (view.type === "input") {
    return (
      <Command key="settings-input" shouldFilter={false}>
        <div className="flex items-center gap-2 border-b px-3 h-12">
          <button
            type="button"
            onClick={handleBackToList}
            className="p-1 hover:bg-accent rounded"
          >
            <ArrowLeftIcon className="size-4" />
          </button>
          <span className="text-sm text-muted-foreground">{view.field.label}</span>
        </div>
        <div className="p-4">
          <input
            type={view.field.type === "number" ? "number" : "text"}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={view.field.placeholder}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
            disabled={isMutating}
          />
          {view.field.description && (
            <p className="mt-2 text-xs text-muted-foreground">{view.field.description}</p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleBackToList}
              className="px-3 py-1.5 text-sm rounded-md hover:bg-accent"
              disabled={isMutating}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
              disabled={isMutating}
            >
              {isMutating && <Loader2Icon className="size-4 animate-spin" />}
              保存
            </button>
          </div>
        </div>
      </Command>
    );
  }

  // リストモード
  return (
    <Command
      key="settings-list"
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
          placeholder="設定項目を検索..."
          value={searchValue}
          onValueChange={handleSearchChange}
          onKeyDown={handleListKeyDown}
          inputMode="email"
          autoFocus
        />
      </div>
      <CommandList>
        <CommandEmpty>項目が見つかりません</CommandEmpty>
        <CommandGroup heading="設定項目">
          {settingFields.map((field) => (
            <CommandItem
              key={field.key}
              className="group"
              value={`${field.label} ${field.description ?? ""}`}
              onSelect={() => handleFieldSelect(field)}
            >
              <span>{field.label}</span>
              <span className="ml-2 text-muted-foreground text-xs group-data-[selected=true]:text-accent-foreground">
                現在: {getCurrentValue(field.key) || "(未設定)"}
              </span>
              <ChevronRightIcon className="ml-auto size-4 text-muted-foreground group-data-[selected=true]:text-accent-foreground" />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
