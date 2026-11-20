"use client";

import type { CSSProperties } from "react";

import { Block } from "@/components/Layout/Block";
import { Span } from "@/components/TextBlocks/Span";

export type UnsupportedPreviewProps = {
  message?: string;
  className?: string;
  style?: CSSProperties;
};

export const UnsupportedPreview = ({
  message = "プレビューに対応していないファイル形式です",
  className,
  style,
}: UnsupportedPreviewProps) => {
  return (
    <Block className={className} style={style}>
      <Span inline>{message}</Span>
    </Block>
  );
};
