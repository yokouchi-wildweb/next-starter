// src/components/Overlays/DetailModal/DetailModal.tsx
//
// DetailModal コンポーネントの使い方
// -----------------------------------
// open と onOpenChange でモーダルの表示状態を制御します。
// title にタイトル文字列を渡し、任意で badge に { text, colorClass } を
// 指定するとタイトル横にバッジが表示されます。
// image に { url, alt } を指定すると画像を表示できます。
// rows には { label, value } の配列、または ReactNode[] を要素とする配列を渡し、
// 各エントリがテーブルの1行として表示されます。
// footer に ReactNode を渡すとテーブル下部にフッターを表示します。
// className で追加のクラスを指定できます。

"use client";

import { Block } from "@/components/Layout/Block";
import { cn } from "@/lib/cn";

import Modal from "../Modal";
import DetailTable from "./DetailTable";
import type { DetailModalProps } from "./types";

// 実際のモーダルコンポーネント
export default function DetailModal({
  open,
  onOpenChange,
  title,
  badge,
  image,
  rows,
  footer,
  className,
}: DetailModalProps) {
  // ヘッダー部分のタイトル要素を組み立てる
  const badgeText = badge?.text;
  const badgeColorClass = badge?.colorClass ?? "bg-green-500";

  const modalTitle = (
    <span className="flex items-center gap-2 text-2xl">
      {badgeText && (
        <span
          className={cn(
            "inline-block rounded-full border bg-muted px-2 py-0.5 text-xs text-white",
            badgeColorClass,
          )}
        >
          {badgeText}
        </span>
      )}
      {title ?? ""}
    </span>
  );



  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      className={cn("animate-[fade-in-scale] fill-both", className)}
    >
      <Block>
        {image && (
          <img
            src={image.url}
            alt={image.alt ?? ""}
            className="mx-auto w-full max-w-md max-h-80 rounded-md object-contain shadow"
          />
        )}
        {rows && rows.length > 0 && <DetailTable rows={rows} />}
        {footer && <div className="pt-4">{footer}</div>}
      </Block>
    </Modal>
  );
}
