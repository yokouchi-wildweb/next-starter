// src/featureGate/checks/explicitChildren.ts
// 明示的に開けた子の検査(設定の議会 D121、門番 m107 の 1 検査 1 ファイル)。
// fork が src/config/featureGate/switches.config.ts で true にした機能について、dependsOn の先(推移的)のどれかが規則の値で閉なら失敗にする
// (開けたつもりの子が、親が閉で黙って閉のまま)。上流の既定 defaultEnabled true の子(switches に書いていない物)・anyOf は対象にしない。
// 判定は ruleList の評価(configEnabled・transitiveDependencies)をそのまま使う。入口: 門 build の pnpm check proxies と ./explicitChildren.test.ts

import { configEnabled, configRules, explicitlyOpened, transitiveDependencies, type FeatureDependencyNode } from "../ruleList";
import type { FeatureName } from "../types";

/**
 * 明示的に開けた子の親が閉の組を文にする(純関数)。opened = switches で true の名前、isOpen = 規則の値で開いているか
 */
export function closedParentsOfOpened(list: readonly FeatureDependencyNode[], opened: readonly string[], isOpen: (name: string) => boolean): string[] {
  const problems: string[] = [];
  for (const child of opened) {
    const closed = transitiveDependencies(list, child).filter((parent) => !isOpen(parent));
    if (closed.length === 0) continue;
    problems.push(
      `機能 ${child} を switches.config.ts で開けたが、依存先 ${closed.join("・")} が閉なので ${child} は閉のまま。直し方は 2 つ: ` +
        `(1) 親を開ける: ${closed.map((parent) => `pnpm ops features set ${parent} on`).join(" / ")} ` +
        `(2) 子を開けない: src/config/featureGate/switches.config.ts から ${child} の行を消す`,
    );
  }
  return problems;
}

/** 今の木の検査 */
export function checkExplicitChildren(): { problems: string[]; checked: number } {
  const opened = explicitlyOpened();
  return { problems: closedParentsOfOpened(configRules, opened, (name) => configEnabled(name as FeatureName)), checked: opened.length };
}
