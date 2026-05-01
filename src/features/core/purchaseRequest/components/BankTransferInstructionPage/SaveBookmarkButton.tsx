// src/features/core/purchaseRequest/components/BankTransferInstructionPage/SaveBookmarkButton.tsx
//
// この画面を保存するためのボタン。
// 振込完了後にユーザーが再訪して「振込完了を申告する」を押せるよう、
// SaveBookmarkModal を開いて URL コピー / 共有 / ブックマーク手順をまとめて提示する。

"use client";

import { useState, useSyncExternalStore } from "react";
import { Bookmark } from "lucide-react";

import { Flex } from "@/components/Layout/Flex";
import { Button } from "@/components/Form/Button/Button";

import { SaveBookmarkModal } from "./SaveBookmarkModal";

// 保存モーダルに表示するページタイトル（メール件名や LINE メッセージにも使われる）
const SAVE_PAGE_TITLE = "銀行振込のご案内";

// 現在ページの URL を SSR/CSR 安全に取得する。
// useSyncExternalStore を使うことで effect 内 setState を避け、
// React の hydration フローに値の切替を委ねる。
const subscribeNoop = () => () => {};
const getUrlClient = () => window.location.href;
const getUrlServer = () => "";

export function SaveBookmarkButton() {
  const [open, setOpen] = useState(false);
  const url = useSyncExternalStore(subscribeNoop, getUrlClient, getUrlServer);

  return (
    <>
      <Flex justify="center">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full max-w-xs"
          onClick={() => setOpen(true)}
        >
          <Bookmark className="h-4 w-4" />
          この画面を保存
        </Button>
      </Flex>

      {/* URL が確定してからモーダルをマウント（空 URL でメール/LINE が起動するのを防ぐ） */}
      {url ? (
        <SaveBookmarkModal
          open={open}
          onOpenChange={setOpen}
          title={SAVE_PAGE_TITLE}
          url={url}
        />
      ) : null}
    </>
  );
}
