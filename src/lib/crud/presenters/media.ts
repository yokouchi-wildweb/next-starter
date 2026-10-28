// src/lib/crud/presenters/media.ts
//
// メディア列（mediaUploader / mediaUploaderMulti）と主の集まりの項目（mediaCollection）の一覧表示用サムネイル。
// 値（storage ref・旧 URL）は resolveStorageSrc で表示用 URL に解決する。解決できない値は描かない。

import React from "react";

import { resolveStorageSrc } from "@/lib/storage";

const MULTI_VISIBLE_COUNT = 3;

const REMAINING_CLASS =
  "ml-1 inline-flex items-center justify-center rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground";

/** 値の配列を表示用 URL に解決する（配列でなければ空、解決できない値は外す） */
const resolveSources = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? resolveStorageSrc(item) : null))
        .filter((src): src is string => Boolean(src))
    : [];

const remainingBadge = (remaining: number): React.ReactNode =>
  remaining > 0 ? React.createElement("span", { key: "remaining", className: REMAINING_CLASS }, `+${remaining}`) : null;

/**
 * 単一メディア列のサムネイル（空・解決できない値は null）
 */
export const formatMediaThumbnail = (value: unknown): React.ReactNode => {
  const src = typeof value === "string" ? resolveStorageSrc(value) : null;
  if (!src) return null;
  return React.createElement("img", {
    src,
    alt: "",
    className: "mx-auto h-12 w-12 object-cover",
  });
};

/**
 * 複数メディア列のサムネイル（先頭 3 件を重ねて表示し、残りは +N）
 */
export const formatMediaThumbnails = (value: unknown): React.ReactNode => {
  if (!Array.isArray(value)) return null;
  const sources = value
    .map((item) => (typeof item === "string" ? resolveStorageSrc(item) : null))
    .filter((src): src is string => Boolean(src));
  if (sources.length === 0) return null;
  const visible = sources.slice(0, MULTI_VISIBLE_COUNT);
  const remaining = sources.length - visible.length;
  return React.createElement(
    "div",
    { className: "flex items-center justify-center" },
    [
      ...visible.map((src, index) =>
        React.createElement("img", {
          key: `thumb-${index}`,
          src,
          alt: "",
          className:
            "size-10 rounded border border-background object-cover" +
            (index === 0 ? "" : " -ml-3"),
        }),
      ),
      remaining > 0
        ? React.createElement(
            "span",
            {
              key: "remaining",
              className:
                "ml-1 inline-flex items-center justify-center rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground",
            },
            `+${remaining}`,
          )
        : null,
    ].filter(Boolean),
  );
};

/**
 * 主の集まりの項目（collections オプション）のサムネイル（先頭 1 件と、残りは +N。0 件は null）
 */
export const formatCollectionThumbnails = (value: unknown): React.ReactNode => {
  const sources = resolveSources(value);
  if (sources.length === 0) return null;
  return React.createElement(
    "div",
    { className: "flex items-center justify-center" },
    [
      React.createElement("img", {
        key: "thumb-0",
        src: sources[0],
        alt: "",
        className: "size-10 rounded border border-background object-cover",
      }),
      remainingBadge(sources.length - 1),
    ].filter(Boolean),
  );
};
