// src/components/Badge/BadgeCore.tsx

import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import type { LucideIcon } from "lucide-react";

export type BadgeCoreProps = React.ComponentPropsWithoutRef<"span"> & {
  asChild?: boolean;
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
  ({ asChild = false, icon: Icon, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";

    return (
      <Comp ref={ref} {...props}>
        {Icon && <Icon />}
        <Slottable>{children}</Slottable>
      </Comp>
    );
  }
);

BadgeCore.displayName = "BadgeCore";
