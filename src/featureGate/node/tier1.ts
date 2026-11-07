// src/featureGate/node/tier1.ts(node.ts が読むだけで効く)
// 注入(next.config.ts の FEATURE_GATE_TIER1)の無い node(scripts・テスト)で、全開スイッチ(../openSwitch.ts の isTier1Build)に
// Tier1 の判別を渡す。判別は fork の名前の唯一の読み手 readForkIdentity(cwd の repo、1 回だけ読む)。project.md は門番から直に読まない

import { readForkIdentity } from "@/lib/forkOwnership/forkIds.mjs";

import { setNodeTier1Reader } from "../openSwitch";

let tier1: boolean | null = null;

setNodeTier1Reader(() => (tier1 ??= readForkIdentity(process.cwd()).isTier1));
