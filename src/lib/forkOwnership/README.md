# forkOwnership

fork が upstream(直接の親 Tier)のファイルを、決められた場所の外で書き換えていないかを調べる検査の仕様。

**判定器・受け口の一覧・検査コマンドはまだ無い(段階②で入る。下の「導入の段階」)。** いまあるのは、この仕様と registry の fork の区画の読み取り(`regions.mjs`、下の「registry の fork の区画」)だけ。決定の経緯と見送った案は [docs/journal/2026-10-29--next-starter--fork-ownership-decisions.md](../../../docs/journal/2026-10-29--next-starter--fork-ownership-decisions.md)。

## 目的

- 全ファイルの持ち主を書き出すことはしない。持ち主を知る必要がある場面(lint の厳しさ・削除と書き換えの検査・notice)ごとに、必要な範囲だけを決める
- 受け口の外を変える必要が出たら、まず直接の親へ改良を依頼する(`/order <親>`)。upstream の汎用化の不足を、依頼を通して直していく

## 判定

- 基準 = 直接の親 Tier から最後に取り込んだ版(`/flux` の base と同じ merge-base)。多段の Tier でも直接の親だけを見る
- 所有台帳は作らない。基準との git の比較だけで決める
- 比較の結果の扱い
  - fork が足したファイル(A)= fork の物
  - 基準にあるファイル = 提供者(親)の物。削除(D)・移動・rename は違反。書き換え(M)は受け口の中なら可、外なら原則として失敗
  - fork が先に作り、後で親が同じパスに足したファイルは、取り込んだ時点で親の物
  - 祖先 Tier の lib の中に fork がファイルを足す(A)のは失敗。自分の lib に置いて re-export する
- 生成器の区画(`AUTO-GENERATED` 系の印の中)は検査の対象外。一時許可の指紋(blob)も、fork の区画と生成器の区画を除いて取る

## 受け口の一覧

- fork が書き換えてよい場所の一覧。upstream が持ち、検査は**取り込み済みの upstream 側の版**から読む(fork が一覧を広げて自分を許すことはできない)
- 載せるもの(段階②で一覧にする)
  - registry: ファイルの中の fork の区画(印の対)の中だけ。印の外は upstream の物(下の「registry の fork の区画」)
  - config: config の再設計までは暫定で `src/config/**` 全体(値とキーを区別しない)。削除は違反。Tier1 の config の規則(値だけ・構造の変更は承認)はそのまま
  - 各フレームの `_layout/` の中の、fork が書き換える部分(W のカスタム)
  - CLAUDE.md の CORE_FILES `downstream_owned` に挙がっている物
- 負債の行: upstream 自身が core の中のファイルを下流の編集点として案内している箇所。fork 側には何も書かせず、upstream が負債として一覧に載せ、core の外に受け口を用意した notice で外す。件数は Tier1 のテストのコマンドと `/inbox` に出す
- 中間 Tier の一覧にも「下流が消してよい」行は作らない。要らない物は持ち主が自分で消し、merge で流す

## 一時許可

- 対象: 受け口が無い固有の機能、upstream のバグ・性能・セキュリティの修正。既存の受け口で済む物には出さない(受け口へ移す)
- 形: 1 ファイル 1 行。直接の親への依頼の番号を 1 つ以上と、書き換えた中身(fork 側と基準側の git blob id)を書く。どちらかの blob が変われば許可し直す
- 失効: すべての依頼の解決(`resolves:` 付きの notice の取り込み)か、基準側の blob の変化(upstream がそのファイルに触った)の早い方。失効した行・基準と同じに戻った行が残っていれば検査は失敗
- 却下: 元に戻す・受け口へ移す・別の方針で許可し直す、のどれかを必須にする。明示の期限は持たない(放置は `/flux`・`/wen` が毎回一覧に出す)
- 「修正だけ先に取り込む」手段は作らない

## 導入の段階

1. registry の下流の印を 1 種類(開始と終了の対)に統一する(済み。下の「registry の fork の区画」)
2. 受け口の一覧・判定器・検査を入れる。検査は最初から失敗にする(報告だけの段階は置かない)。fork が消したくなり得るルートを feature-gate で止められるように棚卸しする

検査を入れた時点で fork に既にある書き換え・削除・rename・祖先 lib へのファイルの追加は、導入と同時に片付ける。猶予の区画は作らない。

- 片付け方は 3 つのどれか: 受け口へ移す / 元に戻す / 一時許可(直接の親への依頼の番号付き)
- upstream の負債の行(受け口が無い物)に当たる分は、一時許可でいったん通し、受け口ができた notice で外す
- 削除・rename は、feature-gate で止める受け口を用意したうえで「止める → 復元」の順で戻す(すぐ戻すとビルドが壊れたり、復元したページが公開されたりする)

## registry の fork の区画

- `src/registry/` の中で fork が書いてよいのは、次の印の対の間だけ。印の外は upstream の物
  ```ts
  // --- fork entries start (upstream never edits inside) ---
  // --- fork entries end ---
  ```
- 1 ファイルに複数の対を置ける。fork の登録は import を伴うので、import 文の後にも対を置く
- 文言は `.claude/rules/` の marker(`fork entries below (upstream never edits below this line)`)と語を揃えている
- upstream は対の中を編集しない。区画を足す・動かすときは notice で知らせる
- 生成器の区画(`AUTO-GENERATED` 系)は fork の区画ではない(生成器の印の統一は別の論点)
- 古い下流の印 3 通り(`// --- DOWNSTREAM (downstream で追加) ---` / `// --- ここに…（上流は空。下流が追記） ---` / `// --- FORK (手書き) ---`)は、`regions.mjs` が移行のために読める(終わりは字下げの浅い閉じ括弧)。ただし `pnpm test:fork-regions` は残っていれば失敗にする
- API(`regions.mjs`、Node 組み込みだけの `.mjs`)
  - `parseForkRegions(text)` → `{ regions: [{ start, end, legacy }], errors: [{ line, message }] }`(行は 1 始まり、start / end は印の行)
  - `isInForkRegion(regions, line)`: その行が区画の中(印の行を除く)か
  - `FORK_REGION_START` / `FORK_REGION_END` / `LEGACY_FORK_MARKERS`
- 検査: `pnpm test:fork-regions`(`regions.test.mjs`)= `src/registry/**/*.ts` の対が閉じている・入れ子が無い・文言が正しい・古い印が無い + 部品の単体テスト

## CI

- CI は任意。必ず走るのは `/flux` の各区間の verify と手元のコマンド
- 検査のコマンドは CI でも動く作りにする: git の情報だけで判定する・親の場所を remote か環境変数で受け取る・対話しない・終了コードで結果を返す。CI で使いたい fork は自分で設定する

## 鮮度

- 検査のたびに直接の親を取得して基準を求め、notice の台帳と照合する
- 取得できない・古いと分かったときは安全側に倒す(緩めない、「未検証」と表示して合格にしない)
- lint の厳しさは手元の情報だけで決める(確かめられなければ今のパスでの判定)

## folderCatalog との分担

- [`folderCatalog`](../folderCatalog/README.md): 目録(`CATALOG.md`)と実在のディレクトリの整合、lib 単位の所有(目録の節)による lint の厳しさ
- forkOwnership: 直接の親との差分から、受け口の外の書き換え・削除・祖先 lib への追加を見つける
