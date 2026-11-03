# src/styles/README の書き直しと置き場の経緯

> owner: next-starter

## 2026-11-04 README の全面書き直し

余白の評議会(20261103-144012-spacing-optimization)の結論に合わせ、`src/styles/README.md` を「下流が覚えることは 3 つ」(CSS / config / page.tsx)の構成から、デザインの 2 原則 → 層の地図 → 早見表 → 勝ち順 → トークンで動く範囲 → `_base` の構成、の順に書き直した。

- 旧版は data-slot を「overrides.css に書いてはいけないもの」の例に挙げていた。評議会は、fork の CSS が狙ってよい約束を data-slot の印と `:root` の値だけに決め、data-slot は className を渡せない所(枠の部位・部品の内側)にだけ付けることにした。className も data-slot も持つ要素(Main・PageTitle・SecTitle・管理画面の SecTitle)では data-slot が勝つ
- appearance の影は `appearance.ts` の rgba の直書きから、`palette.defaults.css` の `--appearance-shadow-<name>`(light / dark、値は従来のまま)に移した。fork は色と同じ `palette.css` で変える。汎用の影の段は作らない(Tailwind の `--shadow-*` はそのまま)
- 直下の `palette.css` / `typography.css` / `overrides.css` の上流の版は、古い `src/styles/custom/` のパスを含む長い説明コメントだったので、README の早見表を指す 1 行にした。今後、上流は fork 所有のファイルに説明を書かない(README か `.claude/rules/core/style.md` に書く)

## 以前の経緯: 直下と `_base/` の入れ替え

以前は upstream の CSS が直下に並び、fork の値は `custom/`(`custom/index.css` が 3 ファイルを読む)に置いていた。入口の `global.css` は upstream 所有で、fork が自分の CSS を足すには `custom/index.css` を編集する形だった。fork が書く場所が深く、upstream の CSS と同じ階層に並ぶため、fork が upstream の CSS を直接編集してしまう例が出た。共有フォルダの置き場と所有を決めた評議会の結論(fork の物を表に、upstream の物を `_base/` に閉じる)に合わせて入れ替えた。読み込みの順は変えていない(`_base/index.css` の中 = 以前の `global.css` の upstream 部分、その後に以前の `custom/index.css` と同じ 3 ファイル)ので、ビルド済み CSS は入れ替えの前後で同一。`custom/` を残して置き場を 2 つにする案は採らなかった。

同じ考え方の前例: `src/features/core/setting/entities/*.extended.ts`(upstream の基底に下流が拡張を足し、upstream は extended 側を触らない)。
