"use client";

// @/components/Form/Input/Manual/AsyncMultiSelectInput/index.tsx

import {
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  useState,
  useCallback,
} from "react";
import { Loader2 } from "lucide-react";

import {
  Command,
  CommandInput,
} from "@/components/_shadcn/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/_shadcn/popover";
import { Button } from "@/components/Form/Button/Button";
import {
  normalizeOptionValues,
  toggleOptionValue,
  serializeOptionValue,
  type OptionPrimitive,
} from "@/components/Form/utils";
import { type Options } from "@/components/Form/types";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { cn } from "@/lib/cn";
import { type SearchParams, type PaginatedResult } from "@/lib/crud/types";

import { MultiSelectTrigger } from "../MultiSelectInput/MultiSelectTrigger";
import { AsyncMultiSelectOptionList } from "./AsyncMultiSelectOptionList";

export type AsyncMultiSelectInputProps<T> = {
  /** 現在の値（選択されている値の配列） */
  value?: OptionPrimitive[] | null;
  /** フィールド名 */
  name?: string;
  /** 値変更コールバック */
  onChange: (value: OptionPrimitive[]) => void;
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
  /** 編集時の既存選択肢 */
  initialOptions?: Options[];

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
  /** トリガーのクラス名 */
  triggerClassName?: string;
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

export function AsyncMultiSelectInput<T>({
  value,
  name,
  onChange,
  onBlur,
  searchFn,
  getOptionFromResult,
  searchFields,
  minChars = 1,
  limit = 20,
  initialOptions,
  placeholder = "選択してください",
  searchPlaceholder = "Enterで検索",
  emptyMessage = "該当する項目がありません",
  loadingMessage = "検索中...",
  hintMessage = "キーワードを入力してください",
  minCharsMessage,
  disabled,
  className,
  triggerClassName,
  contentClassName,
  popoverContentProps,
  open,
  onOpenChange,
  ...rest
}: AsyncMultiSelectInputProps<T>) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [searchResults, setSearchResults] = useState<Options[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 選択済みアイテムのキャッシュ（検索結果が入れ替わってもラベルを保持するため）
  const [selectedOptionsCache, setSelectedOptionsCache] = useState<Map<string, Options>>(
    () => new Map(),
  );

  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

  const selectedValues = normalizeOptionValues(value);
  const selectedCount = selectedValues.length;

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
    [disabled, isControlled, onOpenChange, onBlur],
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
    [handleSearch],
  );

  const handleToggle = useCallback(
    (optionValue: OptionPrimitive) => {
      const serialized = serializeOptionValue(optionValue);
      const newValues = toggleOptionValue(selectedValues, optionValue);
      const isAdding = newValues.length > selectedValues.length;

      if (isAdding) {
        // 選択時: キャッシュに追加
        const allOptions = [...(initialOptions ?? []), ...searchResults];
        const option = allOptions.find(
          (opt) => serializeOptionValue(opt.value) === serialized,
        );
        if (option) {
          setSelectedOptionsCache((prev) => {
            const next = new Map(prev);
            next.set(serialized, option);
            return next;
          });
        }
      } else {
        // 選択解除時: キャッシュから削除
        setSelectedOptionsCache((prev) => {
          const next = new Map(prev);
          next.delete(serialized);
          return next;
        });
      }

      onChange(newValues);
    },
    [onChange, selectedValues, initialOptions, searchResults],
  );

  const handleClosePicker = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  // 選択済みアイテムの Options を解決（initialOptions + キャッシュから）
  const resolveSelectedOptions = useCallback((): Options[] => {
    const resolved: Options[] = [];
    const resolvedSet = new Set<string>();

    for (const v of selectedValues) {
      const serialized = serializeOptionValue(v);
      if (resolvedSet.has(serialized)) continue;

      // initialOptions → キャッシュの順に探す
      const fromInitial = initialOptions?.find(
        (opt) => serializeOptionValue(opt.value) === serialized,
      );
      if (fromInitial) {
        resolved.push(fromInitial);
        resolvedSet.add(serialized);
        continue;
      }

      const fromCache = selectedOptionsCache.get(serialized);
      if (fromCache) {
        resolved.push(fromCache);
        resolvedSet.add(serialized);
      }
    }

    return resolved;
  }, [selectedValues, initialOptions, selectedOptionsCache]);

  // 表示するオプション: 検索結果 + 選択済みだが検索結果に含まれないもの
  const displayOptions = (() => {
    if (searchState !== "success") {
      // 検索前は選択済みのものだけ表示
      return selectedCount > 0 ? resolveSelectedOptions() : [];
    }

    // 検索結果に含まれない選択済みアイテムを先頭に追加
    const resultValueSet = new Set(
      searchResults.map((opt) => serializeOptionValue(opt.value)),
    );

    const selectedNotInResults = resolveSelectedOptions().filter(
      (opt) => !resultValueSet.has(serializeOptionValue(opt.value)),
    );

    return [...selectedNotInResults, ...searchResults];
  })();

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
      // 選択済みアイテムがある場合はリスト表示
      if (displayOptions.length > 0) {
        return (
          <AsyncMultiSelectOptionList
            options={displayOptions}
            selectedValues={selectedValues}
            onToggle={handleToggle}
            emptyMessage={emptyMessage}
          />
        );
      }

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
    return (
      <AsyncMultiSelectOptionList
        options={displayOptions}
        selectedValues={selectedValues}
        onToggle={handleToggle}
        emptyMessage={emptyMessage}
      />
    );
  };

  return (
    <div className={cn("w-full", className)} {...rest}>
      <Popover open={resolvedOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <MultiSelectTrigger
            placeholder={placeholder}
            selectedCount={selectedCount}
            open={resolvedOpen}
            disabled={disabled}
            className={triggerClassName}
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          {...popoverContentProps}
          className={cn(
            "surface-ui-layer w-[min(320px,90vw)] p-0",
            contentClassName,
            popoverContentProps?.className,
          )}
        >
          <Stack space={0} padding="none">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={searchPlaceholder}
                value={searchQuery}
                onValueChange={setSearchQuery}
                onKeyDown={handleKeyDown}
              />
              {renderListContent()}
            </Command>
            <Flex
              padding="sm"
              justify="end"
              className="border-t border-border bg-popover"
            >
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  event.stopPropagation();
                  handleClosePicker();
                }}
              >
                選択を確定
              </Button>
            </Flex>
          </Stack>
        </PopoverContent>
      </Popover>
    </div>
  );
}
