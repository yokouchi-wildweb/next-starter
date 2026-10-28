# DOWNSTREAM NOTICE id:20261028-165213-owned-child-domain-collection
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-28T16:52:13+09:00
severity: action-required
checkpoint: owned-child-domain-collection
change: ドメイン集約の生成器の段。主の domain.json の fields に集まりの項目（fieldType "mediaCollection"、collection: { domain, maxItems, duplicate }）を書いて pnpm dc:generate すると、従属ドメインの domain.json が無いときだけ書き出され（主への required CASCADE の belongsTo・メディア項目 file・並び列・汎用 API と管理画面は閉じる・権限は主から写す）、従属 → 主の順に生成され、主の services/server/collections.ts（registry の区分で毎回）と生成する drizzleBase の collections の配線まで済む。書く前に組の検査（ファイル条件の置き場・belongsTo・論理削除・メディア列・並び列・埋められない必須列・権限の食い違い・63 字・名前の衝突・必須 × duplicate:false）を全件まとめて行い、1 つでも誤りがあれば何も書かない。dc:delete は集まりの組が残っていれば止まる。dc:init / dc:add に集まりの問い。lib の CrudCollectionConfig に minItems（必須をサーバーでも 400）。一覧の表示 formatCollectionThumbnails（1 枚目 + 残り +N）。upstream の sample に例（主 sample の images と従属 sampleImage、表 sample_images）
why: upstream の sample に従属の表 sample_images が増えた（sample を残している fork は db:push が要る）。手書きの drizzleBase の主に集まりを足すときは配線の 1 行を自分で足す必要がある。新しく複数メディアを持たせるときの書き方が変わった（集まりを使い、新しい mediaUploaderMulti の列は作らない）
required_actions:
1. 上流を merge する（生成器・lib・sample・登録表の生成物が入る）
2. [user-run] pnpm db:push（upstream の sample の従属 sample_images の表を作る。sample ドメインを消している fork は不要。既存の表・列は変わらない）→ pnpm db:push:check が 0 件
3. fork 自身の domain.json は何も変えなくてよい（集まりの項目を持たないドメインの生成物は 1 文字も変わらない）。生成し直す必要もない
4. （fork への制約 D28）drizzleBase を手書きしている主（generateFiles.serverServices: false）に集まりの項目を足すときは、その drizzleBase.ts に `import { collections } from "./collections";` を足し、createCrudService の options に `collections` を渡す。手書きのファイルは生成器が触れない。漏れは生成時の案内の行と `pnpm test:collection-wiring`（domain.json の集まりの項目 × 登録表から読んだ主のサービスの collectionFields の突き合わせ）で分かる
5. `pnpm typecheck` `pnpm lint` を通す
verify: `pnpm typecheck` `pnpm lint` が通る | `pnpm test:collection-wiring` が通る | 手順 2 の後 `pnpm db:push:check` が 0 件 | 生成器を触る fork は `pnpm dc:parity <merge 前の HEAD>` で自分の domain.json の生成物が変わらないことを確かめられる
manual_steps: -
refs: src/features/README.md「主の集まりの項目」, src/lib/crud/README.md「ドメイン集約（collections オプション）」, scripts/domain-config/README.md, CLAUDE.md FEATURES media_collection, src/features/sample/domain.json（images）, src/features/sampleImage/, scripts/registry/collectionWiring/
notes:
- Existing mediaUploaderMulti (text[]) media fields keep working for now. Migrate them to a mediaCollection field (an owned child domain) right after taking this notice: the old multi way is planned to be removed from the generator later (first hidden from dc:init / dc:add, then removed once every fork has migrated). Migration steps will follow as an upstream guideline in a later notice. Do not add new mediaUploaderMulti fields.
- 集まりの項目を後で全部外しても services/server/collections.ts は残る（drizzleBase が読まなくなるので害はない。不要なら消してよい）
- 主の集まりの項目の model の型は省略可の string[]（belongsToMany の ID 配列と同じ扱い。サービスの行の型は表の列から作られるため）
- 追加の test スクリプト（依存の追加なし）: test:crud-presenters, test:collection-wiring, test:dc-collection-field, test:dc-child-domain, test:dc-pair-generate, test:dc-pair-checks, test:dc-delete-stop, test:dc-parent-outputs
- 削除・移動なし。dc:generate は従属を消さない（dc:delete の停止だけ）
- 開発で :3000 以外のポートから GCS の非公開バケットに上げると、バケットの CORS の origin に無ければ署名 PUT が拒否される（集まりと旧来の multi で同じ、今回の変更の外）
- fork の状態: dc:parity で 10 リポ（88-base TriQ __voranowa boardgame-site next-vnx oripa-demo oripa-do-2 oripa-do pandora voranowa）の domain.json の生成物が不変であることを upstream 側で確かめた。各 fork の merge 後の typecheck は not checked
