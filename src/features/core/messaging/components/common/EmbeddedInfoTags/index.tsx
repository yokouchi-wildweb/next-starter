// src/features/core/messaging/components/common/EmbeddedInfoTags/index.tsx
// 部品(props だけ): 埋め込み情報のタグ(D111 D126)。共通(共通の一覧と enricher)と専用(このテンプレート・連絡の宣言)を分け、専用は色を変える。
// タグは日本語の別名を出し、押すと {{別名}} をコピー(onCopy、hook useEmbeddedInfoTags)。ツールチップは出さない(使い方は見出しの 1 行)。
// unknownNames = 今の文の中の一覧に無い名前(使えない印)。一覧は hook が lib の embeddedCatalog から作る

"use client";

import { SoftBadge } from "@/components/Badge/SoftBadge";
import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";
import { cn } from "@/lib/cn";
import type { MessageEmbeddedEntry } from "@/lib/messaging";

/** 使い方の 1 行(見出しの下。吹き出しの題の下にも使う) */
export const EMBEDDED_INFO_USAGE = "クリックでコピー、本文の中にペーストして埋め込み";

export type EmbeddedInfoTagsProps = {
  /** 共通の埋め込み情報(共通の一覧 + enricher) */
  common: readonly MessageEmbeddedEntry[];
  /** 専用の埋め込み情報 */
  own: readonly MessageEmbeddedEntry[];
  /** タグを押した時(別名を渡す。呼び手が {{別名}} をコピーする) */
  onCopy?: (alias: string) => void;
  /** 今の文の中の知らない名前 */
  unknownNames?: readonly string[];
  /** 見出しを出すか(既定 true) */
  showTitle?: boolean;
};

export function EmbeddedInfoTags({ common, own, onCopy, unknownNames = [], showTitle = true }: EmbeddedInfoTagsProps) {
  return (
    <Stack gap="xs" data-slot="embedded-info-tags">
      {showTitle ? (
        <Stack gap="none">
          <Span size="sm" weight="semiBold">
            埋め込み情報
          </Span>
          <Span size="xs" tone="muted">
            {EMBEDDED_INFO_USAGE}
          </Span>
        </Stack>
      ) : null}
      <TagGroup title="共通" entries={common} onCopy={onCopy} empty="共通の埋め込み情報はありません" />
      <TagGroup title="専用" entries={own} onCopy={onCopy} own empty="専用の埋め込み情報はありません" />
      {unknownNames.length > 0 ? (
        <Flex align="center" gap="xs" wrap="wrap" data-slot="embedded-info-unknown">
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
    </Stack>
  );
}

type TagGroupProps = {
  title: string;
  entries: readonly MessageEmbeddedEntry[];
  onCopy?: (alias: string) => void;
  own?: boolean;
  empty: string;
};

function TagGroup({ title, entries, onCopy, own, empty }: TagGroupProps) {
  return (
    <Stack gap="2xs" data-slot={own ? "embedded-info-own" : "embedded-info-common"}>
      <Span size="xs" weight="semiBold" tone={own ? undefined : "muted"} className={cn(own && "text-info-text")}>
        {title}
      </Span>
      {entries.length === 0 ? (
        <Span size="xs" tone="muted">
          {empty}
        </Span>
      ) : (
        <Flex gap="xs" wrap="wrap">
          {entries.map((entry) => {
            const name = entry.alias || entry.key;
            // 乗った時の説明(ツールチップ)は出さない(吹き出しの中で邪魔になるため。使い方は見出しの 1 行に書く)
            return onCopy ? (
              <Button
                key={entry.key}
                type="button"
                size="xs"
                variant="outline"
                className={cn(own && "border-info bg-info/10 text-info-text")}
                onClick={() => onCopy(name)}
              >
                {name}
              </Button>
            ) : (
              <SoftBadge key={entry.key} variant={own ? "info" : "outline"} size="sm">
                {name}
              </SoftBadge>
            );
          })}
        </Flex>
      )}
    </Stack>
  );
}
