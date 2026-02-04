"use client";

// src/components/Form/Input/Manual/AsyncComboboxInput.tsx

import {
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEvent,
  useState,
  useMemo,
  useCallback,
} from "react";
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/_shadcn/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/_shadcn/popover";
import { Button } from "@/components/Form/Button/Button";
import { serializeOptionValue, type OptionPrimitive } from "@/components/Form/utils";
import { type Options } from "@/components/Form/types";
import { cn } from "@/lib/cn";
import { type SearchParams, type PaginatedResult } from "@/lib/crud/types";

export type AsyncComboboxInputProps<T> = {
  /** 現在の値 */
  value?: OptionPrimitive | null;
  /** 値変更コールバック */
  onChange: (value: OptionPrimitive | null) => void;
  /** blur コールバック（ポップオーバー閉じた時に発火） */
  onBlur?: () => void;

  // ===== 検索関数 =====
  /** 検索関数（既存のclient.searchをそのまま渡せる） */
  searchFn: (params: SearchParams) => Promise<PaginatedResult<T>>;
  /** T → Options に変換 */
  getOptionFromResult: (item: T) => Options;
  /** 検索対象フィールド */
  searchFields?: string[];

  // ===== オプション =====
  /** 最低入力文字数（デフォルト: 1） */
  minChars?: number;
  /** 取得件数上限（デフォルト: 20） */
  limit?: number;

  // ===== 初期表示用（編集画面で既存値を表示） =====
  /** 編集時の既存値のオプション */
  initialOption?: Options;

  // ===== UI =====
  /** トリガーのプレースホルダー */
  placeholder?: string;
  /** 検索欄のプレースホルダー */
  searchPlaceholder?: string;
  /** 結果0件時のメッセージ */
  emptyMessage?: string;
  /** 検索中のメッセージ */
  loadingMessage?: string;
  /** 初期状態のメッセージ */
  hintMessage?: string;
  /** 最低文字数未満時のメッセージ */
  minCharsMessage?: string;

  /** 無効化 */
  disabled?: boolean;
  /** クリア可能か */
  clearable?: boolean;
  /** トリガーのクラス名 */
  className?: string;
  /** PopoverContent のクラス名 */
  contentClassName?: string;
  /** PopoverContent の props */
  popoverContentProps?: ComponentProps<typeof PopoverContent>;
  /** 開閉状態（制御モード） */
  open?: boolean;
  /** 開閉状態変更コールバック */
  onOpenChange?: (open: boolean) => void;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange">;

type SearchState = "idle" | "loading" | "success" | "error";

export function AsyncComboboxInput<T>({
  value,
  onChange,
  onBlur,
  searchFn,
  getOptionFromResult,
  searchFields,
  minChars = 1,
  limit = 20,
  initialOption,
  placeholder = "選択してください",
  searchPlaceholder = "Enterで検索",
  emptyMessage = "該当する項目がありません",
  loadingMessage = "検索中...",
  hintMessage = "キーワードを入力してください",
  minCharsMessage,
  disabled,
  clearable = false,
  className,
  contentClassName,
  popoverContentProps,
  open,
  onOpenChange,
  ...rest
}: AsyncComboboxInputProps<T>) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [searchResults, setSearchResults] = useState<Options[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (disabled) {
        return;
      }
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
      // ポップオーバーが閉じた時に onBlur を発火
      if (!nextOpen) {
        onBlur?.();
      }
    },
    [disabled, isControlled, onOpenChange, onBlur]
  );

  const handleSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < minChars) {
      return;
    }

    setSearchState("loading");
    setErrorMessage(null);

    try {
      const result = await searchFn({
        searchQuery: trimmed,
        searchFields,
        limit,
        page: 1,
      });
      const options = result.results.map(getOptionFromResult);
      setSearchResults(options);
      setSearchState("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "検索に失敗しました");
      setSearchState("error");
    }
  }, [searchQuery, minChars, searchFn, searchFields, limit, getOptionFromResult]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch]
  );

  const handleSelect = useCallback(
    (optionValue: OptionPrimitive) => {
      onChange(optionValue);
      handleOpenChange(false);
    },
    [onChange, handleOpenChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setSearchResults([]);
      setSearchQuery("");
      setSearchState("idle");
    },
    [onChange]
  );

  // 選択中のラベルを取得
  const selectedLabel = useMemo(() => {
    if (value === null || value === undefined) {
      return null;
    }
    const serializedValue = serializeOptionValue(value);

    // initialOption から探す
    if (initialOption && serializeOptionValue(initialOption.value) === serializedValue) {
      return initialOption.label;
    }

    // 検索結果から探す
    const found = searchResults.find(
      (opt) => serializeOptionValue(opt.value) === serializedValue
    );
    return found?.label ?? null;
  }, [value, initialOption, searchResults]);

  const hasValue = selectedLabel !== null;

  // リスト表示内容の決定
  const renderListContent = () => {
    const trimmed = searchQuery.trim();

    if (searchState === "loading") {
      return (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {loadingMessage}
        </div>
      );
    }

    if (searchState === "error") {
      return (
        <div className="py-6 text-center text-sm text-destructive">
          {errorMessage}
        </div>
      );
    }

    if (searchState === "idle") {
      if (trimmed.length === 0) {
        return (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {hintMessage}
          </div>
        );
      }
      if (trimmed.length < minChars) {
        return (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {minCharsMessage ?? `${minChars}文字以上入力してください`}
          </div>
        );
      }
      // 入力はあるがまだ検索していない
      return (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Enterキーで検索
        </div>
      );
    }

    // searchState === "success"
    if (searchResults.length === 0) {
      return <CommandEmpty>{emptyMessage}</CommandEmpty>;
    }

    return searchResults.map((option, index) => {
      const serialized = serializeOptionValue(option.value);
      const key = serialized || `option-${index}`;
      const isSelected =
        value !== null &&
        value !== undefined &&
        serializeOptionValue(value) === serialized;

      return (
        <CommandItem
          key={key}
          value={String(option.label)}
          onSelect={() => handleSelect(option.value)}
          className="cursor-pointer"
        >
          <Check
            className={cn(
              "mr-2 size-4",
              isSelected ? "opacity-100" : "opacity-0"
            )}
          />
          <span className="truncate">{option.label}</span>
        </CommandItem>
      );
    });
  };

  return (
    <div className={cn("w-full", className)} {...rest}>
      <Popover open={resolvedOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={resolvedOpen}
            disabled={disabled}
            className={cn(
              "h-auto w-full justify-between border-muted-foreground/50 py-3 font-normal",
              !hasValue && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {hasValue ? selectedLabel : placeholder}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {clearable && hasValue && (
                <X
                  className="size-4 opacity-50 hover:opacity-100"
                  onClick={handleClear}
                />
              )}
              <ChevronsUpDown className="size-4 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          {...popoverContentProps}
          className={cn(
            "surface-ui-layer w-[--radix-popover-trigger-width] p-0",
            contentClassName,
            popoverContentProps?.className
          )}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchQuery}
              onValueChange={setSearchQuery}
              onKeyDown={handleKeyDown}
            />
            <CommandList className="max-h-60">
              {renderListContent()}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
