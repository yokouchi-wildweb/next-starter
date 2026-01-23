// src/components/Overlays/DetailModal/form.ts

import { ReactNode } from "react";

export type DetailModalCell = {
  label: ReactNode;
  value: ReactNode;
};

export type DetailModalRow = DetailModalCell[] | ReactNode[];

export type DetailModalBadge = {
  text: string;
  colorClass?: string;
};

export type DetailModalMedia = {
  type?: "image" | "video";
  url: string;
  alt?: string;
  poster?: string;
};

export type DetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  titleSrOnly?: boolean;
  badge?: DetailModalBadge;
  media?: DetailModalMedia;
  /** カスタムメディアノード。指定時はmediaより優先して表示 */
  mediaNode?: ReactNode;
  rows?: DetailModalRow[];
  footer?: ReactNode;
  className?: string;
};
