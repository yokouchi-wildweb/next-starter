// src/features/card/hooks/useCardDetailModalViewModel.tsx

"use client";

import { useMemo, type ReactNode } from "react";
import { BookmarkTag } from "@/components/Common/BookmarkTag";
import EditButton from "@/components/Fanctional/EditButton";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import type {
  DetailModalBadge,
  DetailModalImage,
  DetailModalRow,
} from "@/components/Overlays/DetailModal";
import { useCard } from "./useCard";
import { useTitles } from "@/features/title/hooks/useTitles";
import { useCardRarities } from "@/features/cardRarity/hooks/useCardRarities";
import { useCardTags } from "@/features/cardTag/hooks/useCardTags";
import { useSeries } from "@/features/series/hooks/useSeries";
import { useDeleteCard } from "@/features/card/hooks/useDeleteCard";

export type CardDetailModalViewModel = {
  title: string;
  badge?: DetailModalBadge;
  image?: DetailModalImage;
  rows: DetailModalRow[];
  footer: ReactNode;
};

export const useCardDetailModalViewModel = (cardId: string | null) => {
  const { data: card, isLoading } = useCard(cardId);
  const { data: titles = [] } = useTitles();
  const { data: rarities = [] } = useCardRarities();
  const { data: tags = [] } = useCardTags();
  const { data: series = [] } = useSeries();

  const viewModel = useMemo<CardDetailModalViewModel | null>(() => {
    if (!card) {
      return null;
    }

    // ----- 参照データの解決 -----
    const titleName = titles.find((t) => t.id === card.titleId)?.name;
    const rarityName = rarities.find((r) => r.id === card.rarityId)?.name;
    const tagItems = tags.filter((t) => card.tagIds.includes(t.id));
    const seriesItems = series.filter((s) => card.seriesIds.includes(s.id));

    // ----- 表示用の値の整形 -----
    const titleValue = titleName ?? card.titleId;
    const rarityValue = rarityName ?? card.rarityId;
    const modelNumberValue = card.modelNumber ?? "-";
    const marketPriceValue = card.marketPrice != null ? card.marketPrice.toLocaleString() : "-";
    const pointValueValue = card.pointValue != null ? card.pointValue.toLocaleString() : "-";
    const cardTypeValue = card.cardType === "real" ? "実在" : "仮想";

    const seriesValue: ReactNode = seriesItems.length ? (
      <div className="mt-1 flex flex-wrap justify-center gap-1">
        {seriesItems.map((s) => (
          <span key={s.id} className="pill-tag">
            {s.name}
          </span>
        ))}
      </div>
    ) : (
      "-"
    );

    const tagValue: ReactNode = tagItems.length ? (
      <div className="mt-1 flex flex-wrap gap-1">
        {tagItems.map((t) => (
          <BookmarkTag key={t.id}>{t.name}</BookmarkTag>
        ))}
      </div>
    ) : (
      "-"
    );

    const descriptionValue = <span className="whitespace-pre-line">{card.description ?? "-"}</span>;

    // ----- テーブル行の組み立て -----
    const rows: DetailModalRow[] = [
      [
        { label: "タイトル", value: titleValue },
        { label: "レアリティ", value: rarityValue },
        { label: "型番", value: modelNumberValue },
      ],
      [
        { label: "市場価格", value: marketPriceValue },
        { label: "ポイント価値", value: pointValueValue },
        { label: "カードタイプ", value: cardTypeValue },
      ],
      [{ label: "シリーズ", value: seriesValue }],
      [{ label: "タグ", value: tagValue }],
      [{ label: "説明", value: descriptionValue }],
    ];

    // ----- バッジの組み立て -----
    const badge: DetailModalBadge =
      card.state === "active"
        ? { text: "有効", colorClass: "bg-green-500" }
        : { text: "無効", colorClass: "bg-red-500" };

    // ----- 画像情報の組み立て -----
    const image: DetailModalImage | undefined = card.mainImageUrl
      ? { url: card.mainImageUrl, alt: card.name }
      : undefined;

    // ----- フッターの組み立て -----
    const footer = (
      <div className="flex justify-end gap-2">
        <EditButton href={`/admin/cards/${card.id}/edit`} />
        <DeleteButton id={card.id} useDelete={useDeleteCard} title="カード削除" />
      </div>
    );

    return {
      title: card.name,
      badge,
      image,
      rows,
      footer,
    };
  }, [card, rarities, series, tags, titles]);

  return {
    isLoading,
    card: card ?? null,
    viewModel,
  };
};
