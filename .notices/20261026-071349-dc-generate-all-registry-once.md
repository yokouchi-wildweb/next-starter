# DOWNSTREAM NOTICE id:20261026-071349-dc-generate-all-registry-once
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-26T07:13:49+09:00
severity: action-required
checkpoint: dc-generate-all-registry-once
fixes: 20261025-213009-domain-entry-registry
change: (a) `pnpm dc:generate:all` は全ドメインの domainEntry.ts を書いた後に serviceRegistry.ts を 1 回だけ作り直すようになった（今まではドメインごとに作り直し、まだ domainEntry.ts の無い他のドメインの検査で最初のドメインから止まった）。1 ドメインの `pnpm dc:generate <Domain>` は今までどおり最後に作り直す (b) `pnpm test:wiring` は domainEntry.override.ts を domainEntry.ts と同じ「登録の宣言」として扱う (c) `pnpm test:service-registry` は core の既定の access を上書き前の domainEntry.ts で確かめる（fork の domainEntry.override.ts があっても通る）。上書きの無いキーは登録表の access が domainEntry.ts と同じかを確かめる検査が増えた
why: notice 20261025-213009-domain-entry-registry の手順 2 が、業務ドメインを複数持つ fork で最初のドメインで止まっていた（fork 側の不備ではない）。また、その notice が案内した domainEntry.override.ts を置くと、上流の test:wiring と test:service-registry が落ちていた
required_actions:
1. domain-entry-registry の適用を途中で止めている fork は、merge 後に `pnpm dc:generate:all --yes --only registry` を 1 回実行し、`pnpm registry:check` が OK になるのを確かめてから、その notice の手順 4 以降を続ける
2. 回避のために上流のテスト（src/wiring/wiring.test.mjs・scripts/registry/serviceRegistry/serviceRegistry.test.mjs）や生成スクリプト（scripts/domain-config/generate.mjs・generate-all.mjs・generator/registry/index.mjs）を手元で直していたら、その変更を捨てて upstream 版を取る
3. 移行を済ませた fork は `pnpm dc:generate:all --yes --only registry` をもう一度実行して、差分が出ないことだけを確かめる（ドメインごとの `dc:generate` で乗り切った場合も同じ）
verify: `pnpm registry:check` が OK | `pnpm dc:generate:all --yes --only registry` が終了コード 0 で、再実行しても差分が出ない | `pnpm test:wiring` `pnpm test:service-registry` `pnpm test:dc-registry` が通る（domainEntry.override.ts があっても）
manual_steps: -
refs: scripts/domain-config/generate-all.mjs, scripts/domain-config/generate.mjs, scripts/domain-config/generator/registry/index.mjs（--defer-service-registry）, src/wiring/wiring.test.mjs, scripts/registry/serviceRegistry/serviceRegistry.test.mjs, .notices/20261025-213009-domain-entry-registry.md（手順 2〜3 を書き直した）
notes:
- db:push は不要。実行時の挙動は変わらない（変更はテストと生成スクリプトだけ）
- 20261025-213009-domain-entry-registry の手順 2〜3 の文も直した。前の文は「失敗 = 手書き行が残っている」と読めたが、この不具合でも止まっていた
- 上流で確かめたこと: 業務ドメイン 3 つの domainEntry.ts を消した複製で、旧版は最初のドメインで終了コード 1、新版は 1 回で終了コード 0 になり、登録表は差分なし。core の wallet / walletHistory に INTERNAL_ONLY の domainEntry.override.ts を置いて test:wiring と test:service-registry が通る
- fork の状態: not checked（boardgame-site と oripa-do は依頼の中で、この止まり方と回避の方法を報告している）
