"use client";

// @/components/Form/Input/Manual/AsyncMultiSelectInput/index.tsx
// スナップショット方式: ポップオーバーを開いた時に表示順序を確定し、操作中は固定する

import {
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  useState,
  useCallback,
  useRef,
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

// ---- フェーズ ----
// loading:  ポップオーバーを開いた直後、初期アイテム取得中
// idle:     スナップショット表示中（検索前 or 検索クリア後）
// searching: 検索API呼び出し中
// results:  検索結果表示中
// error:    検索 or 初期取得エラー
type Phase = "loading" | "idle" | "searching" | "results" | "error";

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
  // ---- 開閉 ----
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

  // ---- フェーズ & データ ----
  const [phase, setPhase] = useState<Phase>("loading");
  const [searchQuery, setSearchQuery] = useState("");
  const [displaySnapshot, setDisplaySnapshot] = useState<Options[]>([]);
  const [searchResults, setSearchResults] = useState<Options[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ラベル解決用キャッシュ（コンポーネントのライフサイクル全体で保持）
  const labelCacheRef = useRef<Map<string, Options>>(new Map());

  // 初期アイテムのキャッシュ（再度開いた時に再取得しない）
  const fetchedItemsRef = useRef<Options[] | null>(null);

  const selectedValues = normalizeOptionValues(value);
  const selectedCount = selectedValues.length;

  // ---- ラベルキャッシュ操作 ----

  /** Options 配列をキャッシュに登録 */
  const cacheOptions = useCallback((options: Options[]) => {
    for (const opt of options) {
      labelCacheRef.current.set(serializeOptionValue(opt.value), opt);
    }
  }, []);

  /** 選択済み値のラベルを解決（initialOptions → キャッシュの順） */
  const resolveSelectedOptions = useCallback((): Options[] => {
    const resolved: Options[] = [];
    const seen = new Set<string>();

    for (const v of selectedValues) {
      const key = serializeOptionValue(v);
      if (seen.has(key)) continue;
      seen.add(key);

      const fromInitial = initialOptions?.find(
        (opt) => serializeOptionValue(opt.value) === key,
      );
      if (fromInitial) {
        resolved.push(fromInitial);
        continue;
      }

      const fromCache = labelCacheRef.current.get(key);
      if (fromCache) {
        resolved.push(fromCache);
      }
    }

    return resolved;
  }, [selectedValues, initialOptions]);

  // ---- スナップショット構築 ----
  // 選択済み（上部） + 未選択の初期アイテム（下部）の順序で確定
  const buildSnapshot = useCallback(
    (fetchedItems: Options[]): Options[] => {
      const selected = resolveSelectedOptions();
      const selectedSet = new Set(
        selected.map((opt) => serializeOptionValue(opt.value)),
      );

      const unselected = fetchedItems.filter(
        (opt) => !selectedSet.has(serializeOptionValue(opt.value)),
      );

      return [...selected, ...unselected];
    },
    [resolveSelectedOptions],
  );

  // ---- ポップオーバー開閉 ----
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (disabled) return;

      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);

      if (nextOpen) {
        // リセット
        setSearchQuery("");
        setSearchResults([]);
        setErrorMessage(null);

        if (fetchedItemsRef.current) {
          // キャッシュ済み: 即座にスナップショットを構築
          const snapshot = buildSnapshot(fetchedItemsRef.current);
          setDisplaySnapshot(snapshot);
          setPhase("idle");
        } else {
          // 初回: API から取得
          setPhase("loading");
          searchFn({ limit, page: 1 })
            .then((result) => {
              const items = result.results.map(getOptionFromResult);
              fetchedItemsRef.current = items;
              cacheOptions(items);
              const snapshot = buildSnapshot(items);
              setDisplaySnapshot(snapshot);
              setPhase("idle");
            })
            .catch(() => {
              // 取得失敗でも選択済みのみでスナップショットを構築
              fetchedItemsRef.current = [];
              const snapshot = buildSnapshot([]);
              setDisplaySnapshot(snapshot);
              setPhase("idle");
            });
        }
      } else {
        onBlur?.();
      }
    },
    [disabled, isControlled, onOpenChange, onBlur, buildSnapshot, searchFn, limit, getOptionFromResult, cacheOptions],
  );

  // ---- 検索 ----
  const handleSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < minChars) return;

    setPhase("searching");
    setErrorMessage(null);

    try {
      const result = await searchFn({
        searchQuery: trimmed,
        searchFields,
        limit,
        page: 1,
      });
      const options = result.results.map(getOptionFromResult);
      cacheOptions(options);
      setSearchResults(options);
      setPhase("results");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "検索に失敗しました");
      setPhase("error");
    }
  }, [searchQuery, minChars, searchFn, searchFields, limit, getOptionFromResult, cacheOptions]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch],
  );

  // ---- 検索テキスト変更 ----
  const handleSearchQueryChange = useCallback(
    (val: string) => {
      setSearchQuery(val);
      // 検索テキストをクリアしたら idle に戻す
      if (val.trim() === "" && phase === "results") {
        setPhase("idle");
      }
    },
    [phase],
  );

  // ---- トグル ----
  const handleToggle = useCallback(
    (optionValue: OptionPrimitive) => {
      const key = serializeOptionValue(optionValue);
      const newValues = toggleOptionValue(selectedValues, optionValue);
      const isAdding = newValues.length > selectedValues.length;

      if (isAdding) {
        // キャッシュに追加（displaySnapshot + searchResults から探す）
        const allOptions = [...displaySnapshot, ...searchResults];
        const option = allOptions.find(
          (opt) => serializeOptionValue(opt.value) === key,
        );
        if (option) {
          labelCacheRef.current.set(key, option);
        }
      } else {
        labelCacheRef.current.delete(key);
      }

      onChange(newValues);
    },
    [onChange, selectedValues, displaySnapshot, searchResults],
  );

  const handleClosePicker = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  // ---- 表示するオプション ----
  const displayOptions = phase === "results" ? searchResults : displaySnapshot;

  // ---- リスト描画 ----
  const renderListContent = () => {
    if (phase === "loading" || phase === "searching") {
      return (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {loadingMessage}
        </div>
      );
    }

    if (phase === "error") {
      return (
        <div className="py-6 text-center text-sm text-destructive">
          {errorMessage}
        </div>
      );
    }

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

    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  };

  // ---- レンダリング ----
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
                onValueChange={handleSearchQueryChange}
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
