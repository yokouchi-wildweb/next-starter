// src/features/core/messaging/components/common/EmbeddedInfoPopover/index.tsx
// 部品(props だけ): 埋め込み情報の吹き出し。ボタン「{ } 埋め込み情報 共通 N・専用 M」を押すと吹き出しで
// 使い方の 1 行 + タグ(EmbeddedInfoTags、押すとコピー。吹き出しは開いたまま)。テンプレート・送る・文言の編集のモーダルが使う。
// - unknownNames = 文の中の一覧に無い名前。ボタンの横に赤で出したまま(吹き出しを閉じていても気づける)
// - onManage を渡すと吹き出しの下に「専用の埋め込み情報を管理(N)」(押すと吹き出しを閉じて呼ぶ)。テンプレートのモーダルだけ
// - side = 吹き出しの向き(下の帯に置く時は top)

"use client";

import { useState } from "react";
import { Braces, ChevronDown, ChevronUp, TriangleAlert } from "lucide-react";

import { SoftBadge } from "@/components/Badge/SoftBadge";
import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { InfoPopover } from "@/components/Overlays/Popover";
import { Span } from "@/components/TextBlocks/Span";
import type { MessageVarEntry } from "@/lib/messaging";

import { EMBEDDED_INFO_USAGE, EmbeddedInfoTags } from "@/features/core/messaging/components/common/EmbeddedInfoTags";

export type EmbeddedInfoPopoverProps = {
  common: readonly MessageVarEntry[];
  own: readonly MessageVarEntry[];
  /** タグを押した時(別名を渡す。呼び手が {{別名}} をコピーする) */
  onCopy?: (alias: string) => void;
  /** 今の文の中の知らない名前 */
  unknownNames?: readonly string[];
  /** 専用の埋め込み情報の管理を開く(渡すと吹き出しの下にボタン) */
  onManage?: () => void;
  /** 専用の埋め込み情報の数(管理のボタンに添える) */
  manageCount?: number;
  /** 吹き出しの向き @default "top" */
  side?: "top" | "bottom";
};

export function EmbeddedInfoPopover({ common, own, onCopy, unknownNames = [], onManage, manageCount = 0, side = "top" }: EmbeddedInfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const Chevron = side === "top" ? ChevronUp : ChevronDown;
  return (
    <Flex align="center" gap="md" wrap="wrap" className="min-w-0" data-slot="vars-info-popover">
      <InfoPopover
        open={open}
        onOpenChange={setOpen}
        side={side}
        align="start"
        size="xl"
        title="埋め込み情報"
        trigger={
          <Button type="button" size="sm" variant="outline" className="gap-1.5" data-slot="vars-info-open">
            <Braces className="size-4" />
            埋め込み情報
            {/* 数と矢印は文字色を受け継いで薄くする(乗った時は accent の地に合う色のまま薄く) */}
            <Span size="xs" tone="inherit" className="tabular-nums opacity-70">
              {`共通 ${common.length}・専用 ${own.length}`}
            </Span>
            <Chevron className="size-3.5 opacity-70" />
          </Button>
        }
      >
        <Stack gap="sm">
          <Span size="xs" tone="muted">
            {EMBEDDED_INFO_USAGE}
          </Span>
          <EmbeddedInfoTags common={common} own={own} onCopy={onCopy} showTitle={false} />
          {onManage ? (
            <Flex justify="end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  onManage();
                }}
              >
                専用の埋め込み情報を管理{manageCount > 0 ? `(${manageCount})` : ""}
              </Button>
            </Flex>
          ) : null}
        </Stack>
      </InfoPopover>
      {unknownNames.length > 0 ? (
        <Flex align="center" gap="xs" wrap="wrap" data-slot="vars-info-unknown">
          <TriangleAlert className="size-4 text-destructive-text" aria-hidden />
          <Span size="sm" tone="destructive">
            使えない埋め込み情報:
          </Span>
          {unknownNames.map((name) => (
            <SoftBadge key={name} variant="destructive" size="sm">
              {`{{${name}}}`}
            </SoftBadge>
          ))}
        </Flex>
      ) : null}
    </Flex>
  );
}
