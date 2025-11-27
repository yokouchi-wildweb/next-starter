"use client";

import type { CSSProperties } from "react";

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
    <div className={className} style={style}>
      <span>{message}</span>
    </div>
  );
};
