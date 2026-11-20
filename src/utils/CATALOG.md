# src/utils 目録

`src/utils` の単位(直下の 1 ファイル = 1 単位、`src/utils/<名前>`)を、どのリポジトリが作ったかの一覧。

- 節 = 所有者(作ったリポジトリ)。見出しはそのリポの名前(repo.json の `repo_id`)。節は上流から順に並べる(先頭 = Tier1)
- 1 行 = 1 単位: `- src/utils/<名前> — <一行説明>`。単位 = 直下のコードのファイル(拡張子を除いた名前)。テスト・`.gitkeep`・Markdown は単位でない
- 単位を足したら**自分の節に 1 行足す**(自分の節が無ければ末尾に作る)。他の節は編集しない
- 検査: `pnpm test src/lib/folderCatalog/catalog.test.mjs`(実在との不一致・重複・説明の欠落で失敗する)

## next-starter
- src/utils/array — 配列から(重み付きで)ランダムに 1 つ選ぶ
- src/utils/assets — アセットのパス(assetPath・iconPath・imgPath・videoPath・sePath など)
- src/utils/bodyScrollLock — body のスクロールロックを参照カウントで持つ純粋関数
- src/utils/date — 日付の日本語の書式(formatDateJa)と時刻帯の扱い
- src/utils/hash — scrypt による文字列のハッシュと照合
- src/utils/log — 段階つきの開発用ログ
- src/utils/math — 範囲の乱数・決まった種の乱数・確率の判定
- src/utils/string — 空文字の null への正規化・日本語の切り詰め(truncateJapanese)
- src/utils/url — 入力された URL を href に渡してよいかの判定
- src/utils/xShare — X(Twitter)の投稿インテントの URL と開く操作
