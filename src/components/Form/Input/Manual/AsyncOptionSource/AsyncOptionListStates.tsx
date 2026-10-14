"use client";

// src/components/Form/Input/Manual/AsyncOptionSource/AsyncOptionListStates.tsx
//
// 非同期候補リストの状態表示（初回ロード / 初回エラー / 追加読み込み中 / 末尾到達 / 追加読み込みエラー）。
// useAsyncOptionSource の FetchState をそのまま受けて描画する。3 消費者で共通。

import { Loader2 } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";

import { type AsyncOptionFetchState } from "./useAsyncOptionSource";

type InitialStateProps = {
  state: AsyncOptionFetchState;
  loadingMessage?: string;
  /** 初回エラー時の再試行（通常は source.reloadFirstPage） */
  onRetry: () => void;
};

/**
 * 候補が 1 件も無い状態でのロード中 / エラー表示。
 * 該当しない（候補あり or idle）場合は null を返すので、呼び出し側は
 * `<AsyncOptionInitialState .../> ?? <リスト/>` の形では使えず、isInitialState で分岐する。
 */
export function isAsyncOptionInitialState(state: AsyncOptionFetchState) {
  return state.items.length === 0 && (state.status === "loading" || state.status === "error");
}

export function AsyncOptionInitialState({
  state,
  loadingMessage = "読み込み中...",
  onRetry,
}: InitialStateProps) {
  if (state.items.length === 0 && state.status === "loading") {
    return (
      <Flex align="center" justify="center" gap="xs" className="py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {loadingMessage}
      </Flex>
    );
  }

  if (state.items.length === 0 && state.status === "error") {
    return (
      <Stack space={2} padding="md" className="items-center">
        <Span size="sm" tone="destructive">
          {state.errorMessage ?? "読み込みに失敗しました"}
        </Span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          再試行
        </Button>
      </Stack>
    );
  }

  return null;
}

type FooterProps = {
  state: AsyncOptionFetchState;
  hasMore: boolean;
  /** 追加読み込みエラー時の再試行（通常は source.loadMore を error 状態でも通す retry） */
  onRetry: () => void;
};

/**
 * 候補リスト末尾の状態表示（候補が 1 件以上あるときのみ）。
 */
export function AsyncOptionListFooter({ state, hasMore, onRetry }: FooterProps) {
  if (state.items.length === 0) return null;

  if (state.status === "loading") {
    return (
      <Flex align="center" justify="center" gap="xs" className="py-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        読み込み中
      </Flex>
    );
  }

  if (state.status === "error") {
    return (
      <Flex align="center" justify="center" gap="xs" padding="xs">
        <Span size="xs" tone="destructive">
          {state.errorMessage ?? "追加読み込みに失敗しました"}
        </Span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-1 py-0 text-xs text-primary underline"
          onClick={onRetry}
        >
          再試行
        </Button>
      </Flex>
    );
  }

  if (!hasMore) {
    return (
      <Span size="xs" tone="muted" align="center" className="block py-2">
        これ以上ありません
      </Span>
    );
  }

  return null;
}
