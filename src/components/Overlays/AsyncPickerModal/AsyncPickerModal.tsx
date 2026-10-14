"use client";

// src/components/Overlays/AsyncPickerModal/AsyncPickerModal.tsx
//
// 「大量マスタからレコードを選んでリストに入れる」アクション用のモーダル版ピッカー。
// 取得エンジンは Form/Input/Manual/AsyncOptionSource/useAsyncOptionSource を
// AsyncMultiSelectInput（Popover 版）と共有し、クローム（Modal 本体 + footer）だけが異なる。
//
//  - 本体: 検索欄（autofocus）+ 候補リスト（無限スクロール、内側だけがスクロール）
//    複数選択時は「検索 / 選択済み (N)」タブ。選択済みタブは session snapshot
//    （解除しても session 中は行が残り再選択できる）
//  - footer: 「選択済み N件」+ キャンセル + 確定（0 件で disabled、onConfirm 中はスピナー）
//  - 選択状態はモーダルが持つ。open 時に value から初期化し、close で破棄する
//  - onConfirm が resolve したらモーダル自身が onOpenChange(false) を呼ぶ。reject は呼び出し元へ伝搬
//  - onConfirm の items は「この session 中に fetch で見えたレコード」から解決する。
//    value で事前選択されたまま一度も表示されなかった値は items に含まれない（values が正）
//  - multiple=false: 行クリックで即 onConfirm([value], [item]) → close

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Command, CommandInput } from "@/components/_shadcn/command";
import { Button } from "@/components/Form/Button/Button";
import {
  AsyncOptionInitialState,
  AsyncOptionList,
  AsyncOptionListFooter,
  PendingOptionLabel,
  isAsyncOptionInitialState,
  useAsyncOptionSource,
  useSelectionSnapshot,
} from "@/components/Form/Input/Manual/AsyncOptionSource";
import {
  normalizeOptionValues,
  toggleOptionValue,
  type OptionPrimitive,
} from "@/components/Form/utils";
import { type Options } from "@/components/Form/types";
import { Flex } from "@/components/Layout/Flex";
import { StateTabs, StateTabsContent } from "@/components/Navigation/StateTabs";
import Modal from "@/components/Overlays/Modal";
import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { type SearchParams, type PaginatedResult, type SearchRankSpec } from "@/lib/crud/types";

export type AsyncPickerModalProps<T> = {
  /** 表示状態（controlled） */
  open: boolean;
  /** 開閉コールバック。キャンセル / ✕ / 背景クリック / 確定完了で false が渡る */
  onOpenChange: (open: boolean) => void;
  /** タイトル */
  title: ReactNode;
  /** タイトル下の説明文 */
  description?: ReactNode;

  // ===== 検索関数（AsyncMultiSelectInput と同じ） =====
  /** 検索関数（既存の client.search をそのまま渡せる） */
  searchFn: (params: SearchParams) => Promise<PaginatedResult<T>>;
  /** T → Options に変換 */
  getOptionFromResult: (item: T) => Options;
  /** 検索対象フィールド */
  searchFields?: string[];
  /** キーワード検索時の関連度ランキング（デフォルト: true）。AsyncMultiSelectInput と同じ */
  searchRank?: boolean | SearchRankSpec;
  /** 最低入力文字数（デフォルト: 1） */
  minChars?: number;
  /** 1 ページあたりの取得件数（デフォルト: 20） */
  limit?: number;

  // ===== 選択 =====
  /** open 時の初期選択値 */
  value?: OptionPrimitive[];
  /** value のラベルヒント（未解決時は Skeleton 表示） */
  initialOptions?: Options[];
  /** 選択不可にする値（追加済みの行など）。行は表示され、disabledLabelSuffix が付く */
  disabledValues?: OptionPrimitive[];
  /** 選択不可行の label の後ろに付ける表示（デフォルト: 「（追加済み）」） */
  disabledLabelSuffix?: ReactNode;
  /** 複数選択か（デフォルト: true）。false = 行クリックで即確定 */
  multiple?: boolean;
  /**
   * 確定コールバック。items は session 中に fetch で見えたレコードのみ
   * （value で事前選択され一度も表示されなかった値は含まれない。values が正）。
   * Promise を返すと確定ボタンがローディングになり、resolve 後にモーダルが閉じる。
   */
  onConfirm: (values: OptionPrimitive[], items: T[]) => void | Promise<void>;

  // ===== UI =====
  /** 確定ボタンのラベル。関数なら選択件数を受け取る（デフォルト: N件を追加 / 追加） */
  confirmLabel?: string | ((count: number) => string);
  /** キャンセルボタンのラベル（デフォルト: キャンセル） */
  cancelLabel?: string;
  /** 検索欄のプレースホルダー */
  searchPlaceholder?: string;
  /** 結果0件時のメッセージ */
  emptyMessage?: string;
  /** 読み込み中のメッセージ */
  loadingMessage?: string;
  /** 行の表示を差し替える（name + かな の 2 行表示など）。item は fetch 済みのときだけ渡る */
  renderOption?: (option: Options, item: T | undefined) => ReactNode;
  /** 最大幅（Modal へ透過。デフォルト: 560） */
  maxWidth?: number | string;
  /** 箱の高さ（Modal の固定高モード。デフォルト: 600。ビューポート上限でクランプされる） */
  maxHeight?: number | string;
};

type ActiveTab = "search" | "selected";

const DEFAULT_CONFIRM_LABEL = (count: number) => (count > 0 ? `${count}件を追加` : "追加");

export function AsyncPickerModal<T>({
  open,
  onOpenChange,
  title,
  description,
  searchFn,
  getOptionFromResult,
  searchFields,
  searchRank = true,
  minChars = 1,
  limit = 20,
  value,
  initialOptions,
  disabledValues,
  disabledLabelSuffix = "（追加済み）",
  multiple = true,
  onConfirm,
  confirmLabel = DEFAULT_CONFIRM_LABEL,
  cancelLabel = "キャンセル",
  searchPlaceholder = "Enterで検索",
  emptyMessage = "該当する項目がありません",
  loadingMessage = "読み込み中...",
  renderOption,
  maxWidth = 560,
  maxHeight = 600,
}: AsyncPickerModalProps<T>) {
  // ---- 取得エンジン ----
  const source = useAsyncOptionSource<T>({
    searchFn,
    getOptionFromResult,
    searchFields,
    searchRank,
    minChars,
    limit,
    initialOptions,
  });

  // ---- 選択状態（session スコープ） ----
  const [selected, setSelected] = useState<OptionPrimitive[]>([]);
  const selection = useSelectionSnapshot();
  const [activeTab, setActiveTab] = useState<ActiveTab>("search");

  // open 遷移時に初期化。value / reset はインラインで渡されて参照が変わりうるため ref 経由で読む
  // （deps に入れると open 中の親の再レンダーで再 fetch + 選択リセットが走る）
  const valueRef = useRef(value);
  const resetRef = useRef(source.reset);
  const startSnapshotRef = useRef(selection.start);
  // 毎 render 後に最新値へ同期する（宣言順で下の open effect より先に走る）
  useEffect(() => {
    valueRef.current = value;
    resetRef.current = source.reset;
    startSnapshotRef.current = selection.start;
  });

  useEffect(() => {
    if (!open) return;
    const initial = normalizeOptionValues(valueRef.current);
    setSelected(initial);
    startSnapshotRef.current(initial);
    setActiveTab("search");
    resetRef.current();
  }, [open]);

  // ---- 確定 ----
  const { resolveItem } = source;
  const { execute: confirm, isExecuting } = useAsyncAction(async (values: OptionPrimitive[]) => {
    const items = values
      .map((v) => resolveItem(v))
      .filter((item): item is T => item !== undefined);
    await onConfirm(values, items);
    onOpenChange(false);
  });

  // ---- トグル ----
  const { add: addToSnapshot } = selection;
  const handleToggle = useCallback(
    (optionValue: OptionPrimitive) => {
      if (!multiple) {
        void confirm([optionValue]);
        return;
      }
      setSelected((prev) => {
        const next = toggleOptionValue(prev, optionValue);
        if (next.length > prev.length) addToSnapshot(optionValue);
        return next;
      });
    },
    [multiple, confirm, addToSnapshot],
  );

  // ---- ラベル解決（選択済みタブ） ----
  const { resolveOption } = source;
  const selectedSnapshotOptions = useMemo<Options[]>(
    () =>
      selection.snapshot.map(
        (v) => resolveOption(v) ?? { value: v, label: <PendingOptionLabel /> },
      ),
    [selection.snapshot, resolveOption],
  );

  // renderOption は Options 単位のリスト部品に合わせ、item を cache から補って呼ぶ
  const renderRow = useMemo(
    () => (renderOption ? (option: Options) => renderOption(option, resolveItem(option.value)) : undefined),
    [renderOption, resolveItem],
  );

  // ---- 候補リスト ----
  // flex 列の子として残り高さを占有し、リスト内側だけがスクロールする（Popover 版の max-h-60 を解除）
  const listClassName = "min-h-0 flex-1 max-h-none";

  const renderCandidateList = () => {
    const state = source.activeState;

    if (isAsyncOptionInitialState(state)) {
      return (
        <AsyncOptionInitialState
          state={state}
          loadingMessage={loadingMessage}
          onRetry={source.reloadFirstPage}
        />
      );
    }

    return (
      <AsyncOptionList
        selectionMode={multiple ? "multiple" : "single"}
        options={state.items}
        selectedValues={selected}
        onToggle={handleToggle}
        disabledValues={disabledValues}
        disabledLabelSuffix={disabledLabelSuffix}
        renderOption={renderRow}
        emptyMessage={emptyMessage}
        onScroll={source.handleScroll}
        className={listClassName}
        footer={
          <AsyncOptionListFooter
            state={state}
            hasMore={source.hasMore}
            onRetry={source.retryLoadMore}
          />
        }
      />
    );
  };

  const searchPanel = (
    <>
      <CommandInput
        autoFocus
        placeholder={searchPlaceholder}
        value={source.searchQuery}
        onValueChange={source.setSearchQuery}
        onKeyDown={source.handleSearchKeyDown}
      />
      {renderCandidateList()}
    </>
  );

  // ---- footer ----
  const resolvedConfirmLabel =
    typeof confirmLabel === "function" ? confirmLabel(selected.length) : confirmLabel;

  const footer = (
    <Flex align="center" gap="xs" className="w-full">
      {multiple ? (
        <Span size="sm" tone="muted">
          選択済み {selected.length}件
        </Span>
      ) : null}
      <Flex gap="xs" className="ml-auto">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isExecuting}
        >
          {cancelLabel}
        </Button>
        {multiple ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => void confirm(selected)}
            disabled={isExecuting || selected.length === 0}
          >
            {isExecuting ? <Loader2 className="size-4 animate-spin" /> : null}
            {resolvedConfirmLabel}
          </Button>
        ) : null}
      </Flex>
    </Flex>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      headerContent={
        description ? (
          <Para size="sm" tone="muted" className="my-0">
            {description}
          </Para>
        ) : undefined
      }
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      scrollable={false}
      footer={footer}
      onOpenAutoFocus={(e) => {
        // Radix の既定（最初のフォーカス可能要素 = タブ）を抑止し、CommandInput の autoFocus に委譲
        e.preventDefault();
      }}
    >
      <Flex direction="column" className="relative h-full">
        {/* overflow-hidden のままだと scroll container として残り focus 駆動の隠れスクロールが起きるため clip */}
        <Command shouldFilter={false} className="h-full min-h-0 overflow-clip bg-transparent">
          {multiple ? (
            <StateTabs
              size="sm"
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as ActiveTab)}
              tabs={[
                { value: "search", label: "検索" },
                { value: "selected", label: `選択済み (${selected.length})` },
              ]}
              className="h-full min-h-0"
              listClassName="w-full"
            >
              <StateTabsContent value="search" className="flex min-h-0 flex-col">
                {searchPanel}
              </StateTabsContent>
              <StateTabsContent value="selected" className="flex min-h-0 flex-col">
                {selectedSnapshotOptions.length === 0 ? (
                  <Span size="sm" tone="muted" align="center" className="block py-6">
                    選択された項目はありません
                  </Span>
                ) : (
                  <AsyncOptionList
                    options={selectedSnapshotOptions}
                    selectedValues={selected}
                    onToggle={handleToggle}
                    renderOption={renderRow}
                    emptyMessage="選択された項目はありません"
                    className={listClassName}
                  />
                )}
              </StateTabsContent>
            </StateTabs>
          ) : (
            <Flex direction="column" className="h-full min-h-0">
              {searchPanel}
            </Flex>
          )}
        </Command>
        {/* 単一選択は確定ボタンが無いので、onConfirm 中は本体全体をローダーで覆う */}
        {!multiple && isExecuting ? <ScreenLoader mode="local" /> : null}
      </Flex>
    </Modal>
  );
}

export default AsyncPickerModal;
