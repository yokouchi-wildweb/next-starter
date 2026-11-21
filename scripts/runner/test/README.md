# scripts/runner/test — テストの入口(pnpm test)

## Overview

- `pnpm test` の入口: テストのファイルを走査して群に分け、1 ファイル 1 プロセスで node --test を起動する
- テストを書く人の決まり(群の名前・下駄と module mocks をテストに書かない・`// test-flags:`・子の `NODE_TEST_CONTEXT`)は `.claude/rules/core/scripts.md` の tests
- build はテストを回さない

## Usage

```
pnpm test                       # unit + fork の群を全部
pnpm test --db                  # db の群も(DB に届く。ENV_FILE 未設定なら .env.development)
pnpm test --group=db            # その群だけ(unit / fork / db、カンマで複数)
pnpm test src/lib/crud          # パス(前方一致)か glob(src/**/x.test.ts)で絞る
pnpm test --changed             # 範囲の変更に関係するテストだけ(/ship が使う)
pnpm test --list                # 選んだファイルを出すだけ
pnpm test --test-timeout=120    # test() 1 つの時間の上限を延ばす(秒、0 = なし。env TEST_TIMEOUT=120 でも同じ)
pnpm test --file-timeout=300    # 1 ファイルの時間の上限を延ばす(秒、0 = なし。env TEST_FILE_TIMEOUT=300 でも同じ)
```

- 1 本・1 フォルダだけ回す: `pnpm test <パス>`(環境変数の要る物は前に付ける: `FEATURE_GATE_CHECK=all pnpm test scripts/structure/proxies/featureGate.test.mjs`)
- exit 0 = 全部通る(0 本も)/ 1 = 落ちた(時間切れも)/ 2 = 引数・フラグの誤り

### 時間の上限

- 時間の上限(test() 1 つごと): 既定 **60 秒**(node の `--test-timeout`)。終わらない test() は名前付きで落ちる。延ばす: `pnpm test --test-timeout=<秒>` か env `TEST_TIMEOUT=<秒>`(フラグが勝つ、`0` = なし)。1 つだけ長いテストは `test("…", { timeout: <ms> }, …)` で自分で延ばす
- 時間の上限(1 ファイルごと): 既定 **120 秒**。過ぎたファイルは `test: 時間切れ <秒> 秒: <ファイル>` を出して落ち、まとめの failing tests に名前が出る。ほかのファイルは回り続ける
  - 延ばす: `pnpm test --file-timeout=<秒>` か env `TEST_FILE_TIMEOUT=<秒>`(フラグが勝つ)。`0` = 上限なし(調べる時だけ)
  - 時間切れが出たら: 落ちたアサーションの後片付け(`after` で閉じる・`clearInterval`・接続の close)を確かめる。遅いだけのファイルは分けるか、上限を延ばす

### テストを書くとき

- 下駄(`--import` で先に読む `scripts/runner/preload/` の serverOnly・fileTimeout)・時間の上限・module mocks は入口が常に付けるので、テストに書かない
- ほかの node のフラグ: ファイルの先頭行に `// test-flags: <flags>`。入口の許可の一覧(`scan.mjs` の `ALLOWED_FLAGS`、今は空)の物だけ渡し、ほかは止める(exit 2)。足すのは上流
- 終わり方: ファイルのプロセスは自然に終わるのを待つ。偽物にし忘れた hook の通信(SWR + axios)・閉じ忘れたサーバー・止め忘れたタイマーが残ったファイルは終わらず、1 ファイルの上限(下)で `時間切れ` として名前付きで落ちる → テストの側で本物の通信を偽物にする・閉じる
  - `--test-force-exit` は使わない: テストが終わった子を、報告を親へ書き切る前に終えるので、ファイルの後ろの方のテストの結果が消える。消えた分は pass にも fail にも数えられず exit も変わらない(そこで落ちたテストが隠れる)。実測: 同じ木の pnpm test 全体で、付けると 4156〜4195 本と回ごとに揺れ、付けなければ毎回 4219 本
- テストの中で子の `node --test` / `tsx --test` を起動する時は、環境変数から `NODE_TEST_CONTEXT` を外す(親の node --test の印。残ると子は結果を親向けに流し、子が落ちても exit 0 になる。例 `src/utils/date.test.ts`)
- 機能の門番(`src/featureGate`)の全開スイッチ `FEATURE_GATE_OPEN` は子に渡さない(上流の開発の env の `all` をシェルで export していても、テストの答えは規則の値と `overrideSwitches` で決まる)。スイッチそのものを試すテストは自分で env を置く

### 一時フォルダへリポを写すテスト

- 命令や生成器を一時フォルダで走らせるテストは、写すコードを `scripts/runner/test/lib.copyByImports.mjs` の `copyByImports({ from, to, entries, data, nodeModules })` で求める
  - `entries` = 走らせる入口(`from` からの相対)。そこから import(静的・動的・`@/` などの tsconfig の paths)で届く `from` の中のファイルを写す(dpdm、`--changed` と同じ道具)
  - `data` = コードが import ではなくファイルとして読む物(JSON・テンプレート・登録表など)だけを手で挙げる。コードの道は挙げない(lib の置き直しでテストが落ちないように)
  - `nodeModules: true` = `to/node_modules` を `from` の node_modules への symlink にする | 戻り値 = 写した道の一覧
- 入口から辿れる物だけを写したいときは `importedFiles(from, entries)`

## Internals

- 走査: 毎回、git の追跡 + 未追跡(無視されない物)の `*.test.{ts,tsx,mts,mjs,js,cjs}`。一覧ファイルは無い。除く物: `tests/e2e/`(動いているアプリを外から見る物、playwright = `pnpm e2e`)・`*.types.test.*`(型のテスト = `pnpm typecheck` が見る)。`servers/`(別のプログラム)は引数のパス・glob がそこを名指しした時(`pnpm test servers/room`)と、`--changed` の範囲に `servers/` の下の変更がある時だけ(/ship が変えた時に回す)
- 群(ファイル名で決まる): `db` = `*.db.test.*` / `fork` = `tests/` の下(fork が足すテスト)/ `unit` = それ以外
- 起動: `node <tsx の cli> --import ./scripts/runner/preload/serverOnly.mjs --import ./scripts/runner/preload/fileTimeout.mjs --experimental-test-module-mocks --test-timeout=<ms> --test <files>`(1 ファイル 1 プロセス)
  - `--test` の後のファイルを node は glob として読む → 入口はパスの `[ ] { } * ?` を `[x]` の形にして渡す(`[id]/` の下は `[[]id[]]/`)。そのまま渡すと `src/app/**/[id]/` の下のテストが 0 本になり、黙って通る
  - `npx` は通さない: コマンドを shell に渡すので、shell の glob が `[[]id[]]` を `[id]` に戻してしまう(tsx の cli を node で直に起動する)
- `--changed`: 範囲(門 = `scripts/runner/gates` の検査の束、の watch と同じ: 比べる枝との分岐点..HEAD + 作業ツリー + 未追跡、`scripts/runner/gates/changed.mjs`)の変更したファイルについて、テストのファイルから import を辿って(dpdm、`@/` は tsconfig)届くテストと、変更したファイルと同じフォルダのテストを選ぶ。辿れなかったテストは同じフォルダの規則だけで選び「依存を辿れなかった」と出す。範囲が決まらなければ全部回す
- 1 ファイルの時間の上限の仕組み: `scripts/runner/preload/fileTimeout.mjs` が node --test の子(env `NODE_TEST_CONTEXT` の付いたプロセス)の中で unref したタイマーを置き、過ぎたら exit 1。node の `--test-timeout` は `test()` 1 つごとで、テストの後に接続・タイマーが残って終わらないファイルを止められない。同期の無限ループには効かない(タイマーが動けない)
- 役目: `run.mjs` 入口(引数・選ぶ・束ねて起動)・`scan.mjs` 走査・群・`// test-flags:`・`changed.mjs` `--changed` の選び方(dpdm の木と同じフォルダ)

## Verification

- `pnpm test scripts/runner/test`(`testEntry.test.mjs`)
