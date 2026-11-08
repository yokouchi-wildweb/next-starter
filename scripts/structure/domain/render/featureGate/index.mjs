// 生成カテゴリ featureGate: domain.json の closable: true のときだけ、閉じられる形のひな形を write-once で書く(L1.18)。
// - src/featureGate/rules/<camel>.ts: 規則(pathPatterns = 管理画面 /admin/<kebab 複数形>、features = [ドメインのフォルダ]、enabled = ドメインの config)
//   汎用 API の住所 /api/<domain> は書かない(生成器 scripts/structure/extensions が features の domainEntry から導く)
// - src/features/<camel>/config.ts: 既定・型・defineConfig と上書きの合成。`export const <SNAKE>_CONFIG`(合成済み、{ enabled })と <Pascal>Override の型。既定は Tier1 = false(上流の新しい機能は opt-in)、fork = true
// - src/config/features/<camel>.config.ts: 空の上書き(持ち主の config.ts だけが読む、1 対 1 は pnpm check config-overrides)
// どちらも既にあれば書かない(書き捨て)。書いた後の住所・値は手で直す。規則名(= FeatureName)はファイル名 = camel
// 一覧への反映は pnpm generate extensions(forge は続けて回す)。詳細: src/featureGate/README.md「fork での使い方」

import path from "node:path";

import { readForkIdentity } from "../../../../../src/lib/forkOwnership/forkIds.mjs";
import { featureRel } from "../../domain/context.mjs";
import { writeOnce } from "../output.mjs";

/** domain.json が閉じられる形を頼んでいるか @param {object | null | undefined} config */
export const isClosable = (config) => config?.closable === true;

/** 入切の値の定数名(例 sample_item → SAMPLE_ITEM_CONFIG) */
export const configConstName = (ctx) => `${ctx.snake.toUpperCase()}_CONFIG`;

/** Tier1 か(既定値の見分け)。readForkIdentity が読めなければ fork とみなす(既定 true = 今までどおり開いたまま) */
function isTier1(rootDir) {
  try {
    return readForkIdentity(rootDir).isTier1 === true;
  } catch {
    return false;
  }
}

export function ruleContent(ctx) {
  const folder = featureRel(ctx).replace(/^src\/features\//, "");
  const constName = configConstName(ctx);
  return `// src/featureGate/rules/${ctx.camel}.ts
// ${ctx.label}(pnpm generate domain が domain.json の closable: true から書いた書き捨て。以後は手で直す)
// 汎用 API の住所 /api/<domain> は書かない(features のフォルダの domainEntry から生成器が導く)。書き方: src/featureGate/README.md

import { ${constName} } from "@/features/${folder.replace(/^core\//, "")}/config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/${ctx.kebabPlural}",
  ],
  features: [
    "${folder}",
  ],
  enabled: () => ${constName}.enabled,
};
`;
}

/** 上書きの型の名前(例 shop_item → ShopItemOverride) */
export const overrideTypeName = (ctx) => `${ctx.pascal}Override`;
/** 上書きファイルの置き場(src/config/features/<camel>.config.ts、設定 D11・D19) */
export const overrideRel = (ctx) => `src/config/features/${ctx.camel}.config.ts`;
/** ドメインの config の import 指定子(core も @/features/<camel> の別名で書く) */
const configSpecifier = (ctx) => `@/features/${ctx.camel}/config`;

export function configContent(ctx, enabled) {
  const constName = configConstName(ctx);
  const typeName = `${ctx.pascal}Config`;
  const overrideType = overrideTypeName(ctx);
  return `// ${featureRel(ctx)}/config.ts
// ${ctx.label}の設定(既定 + 上書き。pnpm generate domain が domain.json の closable: true から書いた書き捨て)。
// 上書きは ${overrideRel(ctx)}(このファイルだけが読む)。置き方: src/config/README.md。合成: @/lib/defineConfig
// enabled: false にすると門番の規則 src/featureGate/rules/${ctx.camel}.ts がこの機能の画面・API を閉じ、db:push は表を作らない(既存の表は消さない)

import override from "@/config/features/${ctx.camel}.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type ${typeName} = {
  /** この機能を使うか(閉じる値。処理の切り替えの値とは別に持つ) */
  enabled: boolean;
};

const defaults: ${typeName} = {
  enabled: ${enabled},
};

export const ${ctx.camel}ConfigDef = defineConfig(defaults, { label: "${ctx.camel}" });

/** 上書きのファイルの型(\`export default { ... } satisfies ${overrideType}\`) */
export type ${overrideType}<E extends object = Record<never, never>> = OverrideOf<typeof ${ctx.camel}ConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const ${constName}: ${typeName} = ${ctx.camel}ConfigDef.compose(override);
`;
}

export function overrideContent(ctx) {
  const overrideType = overrideTypeName(ctx);
  return `// ${overrideRel(ctx)}
// ${ctx.label}の設定の上書き(持ち主 ${featureRel(ctx)}/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
import type { ${overrideType} } from "${configSpecifier(ctx)}";

export default {} satisfies ${overrideType};
`;
}

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 */
export function renderFeatureGate(ctx, workspace) {
  if (!isClosable(ctx.config)) return [];
  const enabled = !isTier1(workspace.rootDir);
  return [
    writeOnce(path.join(workspace.rootDir, "src", "featureGate", "rules", `${ctx.camel}.ts`), ruleContent(ctx), {
      label: "閉じられる形の規則を生成しました(pnpm generate extensions で一覧へ)",
      keptLabel: "既存のため生成しません（書き捨て）",
    }),
    writeOnce(path.join(ctx.dir ?? workspace.featurePath(ctx.camel), "config.ts"), configContent(ctx, enabled), {
      label: `入切の値の書き始めを生成しました(既定 enabled: ${enabled})`,
      keptLabel: `既存のため生成しません（書き捨て。${configConstName(ctx)}.enabled が無ければ手で足す: 規則の enabled が読む）`,
    }),
    // 持ち主の config.ts と空の上書きは同じ生成で作る(1 対 1、pnpm check config-overrides)
    writeOnce(path.join(workspace.rootDir, overrideRel(ctx)), overrideContent(ctx), {
      label: "空の上書きを生成しました(fork は変えたい値だけ書く)",
      keptLabel: "既存のため生成しません（書き捨て）",
    }),
  ];
}
