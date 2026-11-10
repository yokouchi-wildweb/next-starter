// src/config/featureGate/switches.config.ts
// 機能(門番の規則)の入切の fork の値(持ち主 src/featureGate だけが読む、設定 D91・D92・門番 D35)。上流は空で出荷し、出荷後に書き換えない。
// 機能の名前と値の組をリテラルで並べる。書かない機能は規則のファイルの defaultEnabled(必須)。未知の名前は型で落ち、実行時も throw
// 例: `export default { wallet: false, sampleDomain: false } satisfies FeatureSwitches;` / 書く道具: pnpm ops features set <名前> on|off
import type { FeatureSwitches } from "@/featureGate";

export default {} satisfies FeatureSwitches;
