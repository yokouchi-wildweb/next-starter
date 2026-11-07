// src/featureGate/ruleList.ts
// 判定の入口(門番の中で 1 つ): 生成一覧 extensions/rules を包み、各規則の enabled を「全開スイッチで開いていれば true、
// でなければ規則の enabled()」に差し替えた一覧 rules を出す。門番の判定(evaluate・clientState・node の道具)と
// node.ts の rules を受け取る外の読み手(routes:map・検査)は、この一覧と ruleEnabled だけを通る。
// 守り(checks/openSwitch.test.ts): 門番の中で extensions/rules を値で読むのも、規則の .enabled() を直に呼ぶのもこのファイルだけ
// スイッチ: ./openSwitch.ts / 詳細: ./README.md

import { rules as generatedRules } from "./extensions/rules";
import { currentOpenSwitch } from "./openSwitch";
import type { FeatureName, GatedFeatureRule } from "./types";

const knownNames: ReadonlySet<string> = new Set(generatedRules.map((rule) => rule.name));
const generatedByName = new Map<string, GatedFeatureRule>(generatedRules.map((rule) => [rule.name, rule]));

/** 全開スイッチで開いているか(スイッチの値に未知の名前があれば throw) */
export function isOpenedBySwitch(name: FeatureName): boolean {
  const opened = currentOpenSwitch(knownNames);
  return opened === "all" || (opened !== null && opened.has(name));
}

/** 規則の一覧(生成一覧の順)。enabled() = スイッチで開いている || 規則の enabled()(規則は呼ぶたびに読む) */
export const rules: GatedFeatureRule[] = generatedRules.map((rule) => ({
  ...rule,
  enabled: () => isOpenedBySwitch(rule.name) || rule.enabled(),
}));

/** 規則が開いているか(門番の判定はこれを呼ぶ。渡すのはこの一覧の規則か、テストの作り物) */
export function ruleEnabled(rule: Pick<GatedFeatureRule, "enabled">): boolean {
  return rule.enabled();
}

/** 規則の値そのもの(スイッチを通さない。features:list の見せ方用)。未知の名前は throw */
export function configEnabled(name: FeatureName): boolean {
  const rule = generatedByName.get(name);
  if (!rule) throw new Error(`featureGate: 未知の機能の名前 "${String(name)}"(src/featureGate/rules/<名前>.ts が無い)`);
  return rule.enabled();
}
