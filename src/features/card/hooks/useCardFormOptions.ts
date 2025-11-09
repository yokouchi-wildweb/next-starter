// src/features/card/hooks/useCardFormOptions.ts

"use client";

import { useEffect, useMemo } from "react";
import type { UseFormReturn, Path, PathValue } from "react-hook-form";
import type { Options } from "@/types/form";
import type { CardRarity } from "@/features/cardRarity/entities";
import type { Series } from "@/features/series/entities";

export type CardFormOptionFields = {
  titleId?: string;
  rarityId?: string;
  seriesIds?: string[];
};

export const useCardFormOptions = <
  TFieldValues extends CardFormOptionFields,
>(
  methods: UseFormReturn<TFieldValues>,
  rarities: CardRarity[],
  series: Series[],
) => {
  const selectedTitleId = methods.watch(
    "titleId" as Path<TFieldValues>,
  );

  const filteredRarities = useMemo(
    () => rarities.filter((r) => r.titleId === selectedTitleId),
    [rarities, selectedTitleId],
  );
  const rarityOptions: Options[] = filteredRarities.map((r) => ({
    value: r.id,
    label: r.name,
  }));

  const filteredSeries = useMemo(
    () => series.filter((s) => s.titleId === selectedTitleId),
    [series, selectedTitleId],
  );
  const seriesOptions: Options[] = filteredSeries.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  useEffect(() => {
    const currentRarityId = methods.getValues("rarityId" as Path<TFieldValues>);
    if (
      currentRarityId &&
      !filteredRarities.some((r) => r.id === currentRarityId)
    ) {
      methods.setValue(
        "rarityId" as Path<TFieldValues>,
        "" as PathValue<TFieldValues, Path<TFieldValues>>,
      );
    }
    const currentSeriesIds =
      (methods.getValues("seriesIds" as Path<TFieldValues>) ?? []) as string[];
    if (currentSeriesIds.length > 0) {
      const valid = currentSeriesIds.filter((id) =>
        filteredSeries.some((s) => s.id === id),
      );
      if (valid.length !== currentSeriesIds.length) {
        methods.setValue(
          "seriesIds" as Path<TFieldValues>,
          valid as PathValue<TFieldValues, Path<TFieldValues>>,
        );
      }
    }
  }, [filteredRarities, filteredSeries, methods]);

  return { rarityOptions, seriesOptions };
};

