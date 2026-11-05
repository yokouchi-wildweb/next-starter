// scripts/runner/gates/features.ts — 機能の開閉を JSON で出す(門のランナーが gate.json の features を見る時だけ子プロセスで呼ぶ)
// 中身は門番の規則 @/featureGate/node の rules の enabled()。出力: {"<機能名>": true|false, ...}
import { rules } from "@/featureGate/node";

const out: Record<string, boolean> = {};
for (const r of rules) out[r.name] = r.enabled();
process.stdout.write(JSON.stringify(out));
