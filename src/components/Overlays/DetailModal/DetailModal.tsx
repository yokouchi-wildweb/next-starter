// src/components/Overlays/DetailModal/DetailModal.tsx
//
// DetailModal コンポーネントの使い方
// -----------------------------------
// open と onOpenChange でモーダルの表示状態を制御します。
// title にタイトル文字列を渡し、任意で badge に { text, variant } を
// 指定するとタイトル横にバッジ(SolidBadge)が表示されます。
// media に { type, url, alt, poster } を指定すると画像/動画を表示できます。
// rows には { label, value } の配列、または ReactNode[] を要素とする配列を渡し、
// 各エントリがテーブルの1行として表示されます。
// footer に ReactNode を渡すとテーブル下部にフッターを表示します。
// className で追加のクラスを指定できます。

"use client";

import { SolidBadge } from "@/components/Badge";
import { Block } from "@/components/Layout/Block";
import { cn } from "@/lib/cn";

import Modal from "../Modal";
import DetailModalVideo from "./DetailModalVideo";
import DetailTable from "./DetailTable";
import type { DetailModalProps } from "./types";

// 実際のモーダルコンポーネント
export default function DetailModal({
  open,
  onOpenChange,
  title,
  titleSrOnly,
  badge,
  media,
  mediaNode,
  rows,
  footer,
  className,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: DetailModalProps) {
  // ヘッダー部分のタイトル要素を組み立てる
  const badgeText = badge?.text;

  const modalTitle = (
    <span className="flex items-center gap-2 text-2xl">
      {badgeText && (
        <SolidBadge
          size="sm"
          variant={badge?.variant ?? "success"}
          className="border"
        >
          {badgeText}
        </SolidBadge>
      )}
      {title ?? ""}
    </span>
  );



  // mediaNodeが渡された場合はそれを優先、なければmediaから生成
  const mediaType = media?.type ?? "image";
  const generatedMediaNode =
    media &&
    (mediaType === "video" ? (
      <DetailModalVideo media={media} />
    ) : (
      <img
        src={media.url}
        alt={media.alt ?? ""}
        className="mx-auto w-full max-w-md max-h-80 rounded-md object-contain shadow"
      />
    ));
  const resolvedMediaNode = mediaNode ?? generatedMediaNode;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      titleSrOnly={titleSrOnly}
      className={cn("animate-[fade-in-scale] fill-both", className)}
      onOpenAutoFocus={onOpenAutoFocus}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <Block>
        {resolvedMediaNode}
        {rows && rows.length > 0 && <DetailTable rows={rows} />}
        {footer && <div className="pt-4">{footer}</div>}
      </Block>
    </Modal>
  );
}
