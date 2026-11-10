// src/lib/frameDims/config.ts — 枠の寸法の設定(既定 + src/config/lib/frameDims.config.ts の上書き)。説明: README.md

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/frameDims";

/** 枠の寸法変数の名前(CSS のカスタムプロパティ) */
export type FrameDimVar = `--${string}`;

export type FrameDimsConfig = {
  /** 外枠の印(UserLayout・AdminLayout の外枠の公開の属性) */
  rootSelector: string;
  /**
   * 部位の名前 → 寸法変数の名前。部位の名前は枠の部位一覧(src/app/_layout/frame/parts.mjs の data-slot)に合わせる。
   * 値の意味と書く所: src/app/(user)/_layout/README.md「寸法の CSS 変数」、変数を定義するのは src/styles/core/frame.css
   */
  vars: {
    header: FrameDimVar;
    "app-banner": FrameDimVar;
    "bottom-nav": FrameDimVar;
  };
};

const defaults: FrameDimsConfig = {
  rootSelector: "[data-frame-root]",
  vars: {
    header: "--app-header-height",
    "app-banner": "--app-banner-height",
    "bottom-nav": "--app-bottom-nav-height",
  },
};

export const frameDimsConfigDef = defineConfig(defaults, { label: "frameDims" });

/** 上書きのファイル(src/config/lib/frameDims.config.ts)の型 */
export type FrameDimsOverride<E extends object = {}> = OverrideOf<typeof frameDimsConfigDef, E>;

export const frameDimsConfig: FrameDimsConfig = frameDimsConfigDef.compose(override);
