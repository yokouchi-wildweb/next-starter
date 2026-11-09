# scripts/structure/config-overrides — 上書きと持ち主の 1 対 1 の検査

`src/config` の上書きファイルが、持ち主(地区)の `config.ts` とちょうど 1 本ずつ揃っているかを見ます(設定 D19・D38・D75)。地区の一覧は地区の地図(`src/lib/districtMap`)から読みます。置き方の決まりは [src/config/README.md](../../../src/config/README.md)。

```bash
pnpm check config-overrides        # 門 build・ship・forge:post(district-map の後)
```

exit 0 = 余り 0・欠落 0 / 1 = 揃っていない、または地区の地図に問題がある(先に `pnpm check district-map` を直す)。

## 見る所

- 地区の 4 種 `src/config/lib/`・`features/`・`layout/`・`proxies/` と、基盤の上書き `src/config/featureGate/`(設定 D91)の直下だけ。古い `app/`・`ui/` と `src/config` 直下のファイルは見ません(移行中、空になったら消す)
- 置ける物: `<名前>.config.ts`(値の上書き)・`<名前>.ui.config.ts`(描画専用の上書き)・`README.md`。サブフォルダは置けません(中は平ら、設定 D11)

## 落とす物

- 余り(読まれず黙って効かない)
  - 持ち主の地区が無い上書き(lib・ドメインの削除・改名・打ち間違い)。`layout/` は `_layout/config.ts` の `frame: "<名前>"` の宣言と照らし、`proxies/` は `src/proxies/<テーマ>/config.ts` を持つテーマのフォルダと照らす(設定 D93)
  - 持ち主はいるが `config.ts` が無い上書き / 持ち主が `config.ui.ts` を持たないのに置いた `<名前>.ui.config.ts`
- 欠落
  - features・枠・proxies: `config.ts` があるのに上書きが無い(上書きを import していなければ tsc は落とさない。上流は空の上書きを同じ commit で置く、設定 D9)
  - lib: package.json を宣言した lib は `pnpm check lib-package` が上書きの欠落を落とすので数えません。宣言の無い lib は数えます
  - 描画専用: `config.ui.ts` があるのに `<名前>.ui.config.ts` が無い(全種類)
- 基盤の上書き `featureGate/`: 持ち主は `src/featureGate` に固定(地区でない)。置ける物は `<中身の名前>.config.ts`(例 `switches.config.ts`)と `README.md` だけで、サブフォルダ・`.ui.config.ts`・他の名前は余り。`src/featureGate` が無い木で置いた物も余り。どの名前を置くかは持ち主の物なので欠落は数えません
- fork が足した持ち主も同じに数えます

## テスト

`pnpm test scripts/structure/config-overrides`(一時フォルダの木で余り・欠落・描画専用の対・基盤の上書き・古いフォルダを見ないこと、今の木で 0 件)
