# scripts/runner/test — テストの入口(pnpm test)

```
pnpm test                       # unit + fork の群を全部
pnpm test --db                  # db の群も(DB に届く。APP_ENV 未設定なら .env.development)
pnpm test --group=db            # その群だけ(unit / fork / db、カンマで複数)
pnpm test src/lib/crud          # パス(前方一致)か glob(src/**/x.test.ts)で絞る
pnpm test --changed             # 範囲の変更に関係するテストだけ(/ship が使う)
pnpm test --list                # 選んだファイルを出すだけ
```

- 走査: 毎回、git の追跡 + 未追跡(無視されない物)の `*.test.{ts,tsx,mts,mjs,js,cjs}`。一覧ファイルは無い。除く物: `tests/e2e/`(動いているアプリを外から見る物、playwright = `pnpm e2e`)・`*.types.test.*`(型のテスト = `pnpm typecheck` が見る)。`servers/`(別のプログラム)は引数のパス・glob がそこを名指しした時だけ(`pnpm test servers/room`)
- 群(ファイル名で決まる): `db` = `*.db.test.*` / `fork` = `tests/` の下(fork が足すテスト)/ `unit` = それ以外
- 起動: `npx tsx --import ./scripts/runner/preload/serverOnly.mjs --experimental-test-module-mocks --test <files>`(1 ファイル 1 プロセス)。下駄と module mocks は入口が常に付けるのでテストに書かない
- ほかの node のフラグ: ファイルの先頭行に `// test-flags: <flags>`。入口の許可の一覧(`scan.mjs` の `ALLOWED_FLAGS`、今は空)の物だけ渡し、ほかは止める(exit 2)。足すのは上流
- `--changed`: 範囲(門の watch と同じ: 比べる枝との分岐点..HEAD + 作業ツリー + 未追跡、`scripts/runner/gates/changed.mjs`)の変更したファイルについて、テストのファイルから import を辿って(dpdm、`@/` は tsconfig)届くテストと、変更したファイルと同じフォルダのテストを選ぶ。辿れなかったテストは同じフォルダの規則だけで選び「依存を辿れなかった」と出す。範囲が決まらなければ全部回す
- exit 0 = 全部通る(0 本も)/ 1 = 落ちた / 2 = 引数・フラグの誤り
- build はテストを回さない
- 1 本・1 フォルダだけ回す: `pnpm test <パス>`(環境変数の要る物は前に付ける: `FEATURE_GATE_CHECK=all pnpm test scripts/structure/proxies/featureGate.test.mjs`)
- テスト: `pnpm test scripts/runner/test`(`testEntry.test.mjs`)

## ファイル

- `run.mjs` 入口(引数・選ぶ・束ねて起動)
- `scan.mjs` 走査・群・`// test-flags:`
- `changed.mjs` `--changed` の選び方(dpdm の木と同じフォルダ)
