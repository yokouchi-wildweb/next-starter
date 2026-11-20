# src/hooks 目録

`src/hooks` の単位(直下の 1 ファイル = 1 単位、`src/hooks/<名前>`)を、どのリポジトリが作ったかの一覧。

- 節 = 所有者(作ったリポジトリ)。見出しはそのリポの名前(repo.json の `repo_id`)。節は上流から順に並べる(先頭 = Tier1)
- 1 行 = 1 単位: `- src/hooks/<名前> — <一行説明>`。単位 = 直下のコードのファイル(拡張子を除いた名前)。テスト・`.gitkeep`・Markdown は単位でない
- 単位を足したら**自分の節に 1 行足す**(自分の節が無ければ末尾に作る)。他の節は編集しない
- 検査: `pnpm test src/lib/folderCatalog/catalog.test.mjs`(実在との不一致・重複・説明の欠落で失敗する)

## next-starter
- src/hooks/cursorPage — 続きの位置(カーソル)で取る一覧の 1 回分の応答の型 CursorPage(useInfiniteScrollQuery のカーソルのモード)
- src/hooks/useAsyncAction — 非同期の操作の二重実行を防ぐフック
- src/hooks/useDisableScroll — body のスクロールを止める / 戻すフック
- src/hooks/useElementSize — 要素の幅と高さを取るフック
- src/hooks/useFitScale — 枠に収める拡大率を求めるフック(contain / width / height)
- src/hooks/useFullscreen — 要素(またはページ)の全画面表示の状態と切り替え
- src/hooks/useGlobalCursor — 画面全体のカーソルの形を切り替えるフック
- src/hooks/useInView — 要素が画面に入ったかを IntersectionObserver で見るフック
- src/hooks/useInfiniteScrollQuery — 無限スクロールの一覧の取得(offset / cursor のモード)
- src/hooks/useModalSession — モーダルの「開いた回」の番号
- src/hooks/useWakeLock — 画面のスリープを止める(Screen Wake Lock)
