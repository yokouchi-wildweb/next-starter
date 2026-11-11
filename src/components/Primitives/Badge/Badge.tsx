// src/components/Primitives/Badge/Badge.tsx

import * as React from "react";
import { Slot } from "radix-ui";
import type { LucideIcon } from "lucide-react";

/** 根の印(data-slot)。badge 以外は上流の包む部品(SolidBadge・BookmarkTagBadge)が渡す。fork は名前を変えずに印を狙う */
export type BadgeCoreSlot = "badge" | "solid-badge" | "bookmark-tag-badge";

export type BadgeCoreProps = Omit<React.ComponentPropsWithoutRef<"span">, "slot"> & {
  asChild?: boolean;
  /** 印の名前(上流の包む部品だけが使う。既定 badge)。props の data-slot はこれに負ける */
  slot?: BadgeCoreSlot;
  /** アイコンコンポーネント（Lucideアイコンなど） */
  icon?: LucideIcon;
};

/**
 * バッジ各種の共通レンダリングコア（内部用・バレル非公開）
 *
 * asChild(Slot) と icon の描画を一元化する。
 * icon と children をそのまま並べると Slot は複数childを受け取り
 * 例外を投げるため、children を Slottable で包んで差し込み先を明示する。
 * - asChild 時: children(単一要素)にpropsがマージされ、icon はその要素の内側先頭に展開される
 * - 非 asChild 時: Slottable は透過されるため、従来どおり <span>{icon}{children}</span> と同一のDOM
 *
 * 制約: asChild 時の children は単一のReact要素であること（Slotの仕様）
 */
export const BadgeCore = React.forwardRef<HTMLSpanElement, BadgeCoreProps>(
  ({ asChild = false, icon: Icon, children, slot = "badge", ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "span";

    return (
      <Comp ref={ref} {...props} data-slot={slot}>
        {Icon && <Icon />}
        <Slot.Slottable>{children}</Slot.Slottable>
      </Comp>
    );
  }
);

BadgeCore.displayName = "BadgeCore";
