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

export type DetailModalImage = {
  url: string;
  alt?: string;
};

export type DetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  badge?: DetailModalBadge;
  image?: DetailModalImage;
  rows?: DetailModalRow[];
  footer?: ReactNode;
  className?: string;
};

