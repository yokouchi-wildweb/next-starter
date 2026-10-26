# DOWNSTREAM NOTICE id:20261026-131306-domain-registry-table
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-26T13:13:06+09:00
severity: breaking
checkpoint: domain-registry-table
change: 登録表（serviceRegistry）の 1 行 = domainEntry.ts の各キーが、service・access に加えて table（表の物理名）と idColumn（主キー列の物理名）を型で必須に持つようになった（string | null。null は表を持たない Firestore 版だけ）。core の domainEntry.ts は上流が書いた。dc:generate（registry カテゴリ）が業務ドメインの domainEntry.ts に書く。registry:check（build の冒頭でも走る）が欠け・形・同じ表が 2 キーを、test:service-registry が実物（getTableName / getIdColumnName）との一致を検査する。表 ↔ ドメインを引く同期関数 findDomainByTable / getDomainTable（@/wiring/domains）を追加。全件削除の一覧（getDomainList）はサービスを読み込まず登録表の table で作る
why: table / idColumn の無い domainEntry.ts は typecheck と registry:check（= pnpm build）が落ちる。fork の業務ドメインの domainEntry.ts は再生成しないと 2 行が入らない。generateFiles.registry: false で手書きしている domainEntry.ts と、fork が core パス・独自に手書きした domainEntry.ts は、再生成では書かれないので手で足す必要がある
required_actions:
1. 上流を merge する。core の src/features/core/*/services/server/domainEntry.ts は上流版を取る（fork は core の domainEntry.ts を編集しない。access の上書きは隣の domainEntry.override.ts のまま変わらない）
2. `pnpm dc:generate:all --yes --only registry` を 1 回実行する（業務ドメインの services/server/domainEntry.ts に `table: "<表名>"` / `idColumn: "id"`（Firestore ドメインは null / null）の 2 行が service の直後に入る。表名は表の定義と同じ決め方 = domain.json の plural、無ければドメイン名の snake_case）
3. 再生成で書かれない domainEntry.ts を探して手で足す: generateFiles.registry が false の業務ドメイン、fork が src/features/core/<x>/ に作ったドメイン、その他 fork が手書きした domainEntry.ts。各キーの service の直後に `table: "<そのサービスの getTableName() の値>",` と `idColumn: "<getIdColumnName() の値、生成ドメインなら "id">",` を**文字列リテラルで**書く（定数・式は registry:check が読めずに失敗する）。表を持たない Firestore 版は `table: null, idColumn: null`。探し方: `pnpm registry:check` のエラー（`キー "<key>" に table が無い`）が該当ファイルとキーを全部出す
4. `pnpm registry:check` が OK になるまで 2〜3 を繰り返す（同じ表を 2 つのキーに書いた場合も失敗する。1 つの表は 1 つのドメインだけに登録する）
5. `pnpm test:service-registry` を実行し、全キーの table / idColumn が実物と一致することを確かめる（食い違いはキーと両方の値が出る）
6. fork のコードが getDomainList（@/wiring/domains または @/lib/domain/server）の結果に頼った独自処理を持つなら確かめる: 一覧は読み込みに失敗するドメインも含むようになった（実行時の isValidDomainKey / getInvalidDomainKeys は従来どおりサービスを読み込んで弾く）。grep: `getDomainList`
7. `pnpm typecheck` / `pnpm lint` を通す
verify: `pnpm registry:check` が OK | `pnpm test:service-registry` `pnpm test:wiring` `pnpm test:dc-registry` `pnpm test:dc-sample-drift` が通る | `pnpm typecheck` `pnpm lint` が通る
manual_steps: -
refs: src/lib/domain/README.md（登録表とは・定義ファイル・生成と検査・引く）, src/wiring/README.md, src/lib/domain/types/registry.ts（DomainRegistryEntry）, src/lib/domain/service/server/tableLookup.ts, scripts/registry/serviceRegistry/{discover,generate}.mjs, scripts/domain-config/utils/tableName.mjs, scripts/domain-config/generator/registry/writeDomainEntry.mjs, CLAUDE.md DOMAINS service_registry, .claude/rules/core/api-routes.md（lookup）
notes:
- db:push は不要（スキーマは変わらない）
- 削除・移動なし（git diff --name-status --diff-filter=DR で確認）。追加: src/lib/domain/service/server/tableLookup.ts、scripts/domain-config/utils/tableName.mjs
- 表名の決め方を scripts/domain-config/utils/tableName.mjs の domainTableName に切り出し、generate-drizzle-entity.mjs もこれを使う（表の定義の出力は変わらない）。fork が generate-drizzle-entity.mjs を改造していれば merge で衝突しうる（上流の import 行と tableName の 1 行を取り込む）
- 新しい関数: findDomainByTable(tableName) = 表の物理名 → ドメインキー（登録の無い表・Firestore は null）、getDomainTable(key) = キー → { table, idColumn }（未登録・Firestore は null）。どちらも同期でサービスを読み込まない。サーバーは @/wiring/domains、lib からは @/lib/domain/server に登録表を渡す。機能ごとの「ドメイン ↔ 表」の対応表は作らずこれを使う
- wiring README の規則を「lib から新しく登録表を import しない（既存の例外 6 か所は README に列挙）」に言い直した。CLAUDE.md の service_registry 行（親行 + 子行 2）と core ルール api-routes.md の lookup 行を書き換えた（fork は編集しない）
- fork の状態: not checked
