# 2026-11-24 区切り unconfigured-base → backend-kit → backend-s0 の写しの通し(oripa-do・next-vnx)

> owner: next-starter

注文 08(D31、AMENDMENT 1 = D41)の記録。遅れているフォーク 2 つの使い捨ての写しに、合流地点の 3 つの区切りを当てて、選択表の命令・生成・検査が notice のとおりに動くかを確かめた。env の値はこの記録に書かない(名前と、命令が出した実装の名前だけ)。

## 前提(d1)

- 写しは scratch の使い捨ての `git clone --no-local`。push 先は無効の値にし、本物の checkout・env の値・DB・Vercel には触れていない。終わりに写しは消した
- 固定した SHA: oripa-do `9bf6bb4f2`(改名済み・中間 Tier・メールは sendgrid)/ next-vnx `121ca04f2`(改名前)
- 区切りの点(合流地点 `g2/20261124-161115/junction`): unconfigured-base `eb71a393a` / backend-kit `4831c8457` / backend-s0 `996dfa154`。next-vnx に置いた道具は合流地点 `d34e46a99` の版
- oripa-do の遅れ: `9bf6bb4f2` から `eb71a393a` までは上流の 3 commit(注文が見込んだ 72 件より少ない)、`996dfa154` までは 21 commit
- 写しの env: 本物の `.env.development`・`.env.production` から `MAIL_PROVIDER=` の行だけを写しの同じ名前のファイルへ写した(値は画面にも記録にも出していない)
- 依存: `pnpm install --offline --frozen-lockfile` が両方の写しで通った(ネットワーク不要)
- 終わった後、本物の oripa-do・next-vnx は `git status` 空、HEAD は `9bf6bb4f2`・`121ca04f2` のまま

## oripa-do の写し: 区切りごと(d2・d3・d4)

### 1. unconfigured-base(`eb71a393a`)

- `git merge --no-ff eb71a393a` → 衝突 0、16 files。固有型(5 self)のファイルは変わらない
- required_actions: none

### 2. backend-kit(`4831c8457`)

- `git merge --no-ff 4831c8457` → 衝突 0(`src/lib/CATALOG.md`・`intake.txt`・`district-map.jsonl` は自動で合わさった)、44 files
- フォークに無かった `backend-selection.json` は上流の版 `{}` で届いた(merge の中)
- `pnpm workflow backend-selection fill` → 「足りない鍵は無い(書いていない)」、exit 0。表は `{}` のまま、書く物が無いので merge と別の commit は作らなかった(FINDINGS F4)

### 3. backend-s0(`996dfa154`)

- `git merge --no-ff 996dfa154` → 衝突 1: `src/wiring/startup.ts`(生成物。フォークの項目 `userMetrics/userDirtyFlush` と上流の `mail/mailSelection` が同じ行で当たった)。生成器と同じ並び(差す側/名前の順)で両方の行を残して解いた(FINDINGS F2)
- `backend-selection.json` は衝突せず、上流の `{"mail":"resend"}` が黙って入った(フォークの側は届いた時のまま = 分岐点と同じなので、git は上流の側を取る)。固有型の取り込みの決まり(自分の版を残す)に従い、merge の中でフォークの版 `{}` に戻した(FINDINGS F1)
- merge の後の `fill` → `mail = sendgrid` を書き、`pnpm generate extensions` を流して「差分は選択表と生成物だけ」。最後に「本番(Vercel)の MAIL_PROVIDER が sendgrid か確かめる(違えば build が止まる)」の行を出した
- `backend-selection.json`・`src/lib/mail/extensions/mail.ts`・`src/lib/mail/plugs/startupTasks/mailSelection.ts` を merge と別の commit にした
- 2 回目の `fill` → 「足りない鍵は無い(書いていない)」、作業ツリーの変更 0(d2)
- required_action 3 の `git grep -e "lib/mail/resend" -e "lib/mail/sendgrid" -e "getMailProvider" -- src scripts` → 上流の `src/lib/mail/send.ts` のコメント 1 行だけ。フォークのコードの読み手は無い

### 確かめ(d3)

- `pnpm generate extensions` → 変更なし。`pnpm check extensions` → OK(点 118 / 一覧 68 / 項目 416)
- `src/lib/mail/extensions/mail.ts` = `export { adapter } from "../plugs/mail/sendgrid";`、`selected = "sendgrid"`
- 生成物の `selected` だけを読む小さな tsx の実行(送らない、adapter を呼ばない)→ `selected=sendgrid`

### build の段の止め(d4)

- shell に `MAIL_PROVIDER=resend` を置いて `pnpm check --phase=build` → exit 1。落ちたのは structure/extensions だけで、ほかの対象(business・cron・cycles・eslint・legal・lib-package・next-config・proxies・registry・district-map・config-overrides・admin-menu・cache)は通った
- 止めの文の形: `backend-selection.json: 口 mail は "<選択>" を選ぶが、env MAIL_PROVIDER は "<env を写した実装>" を指す(段 build。直す: pnpm workflow backend-selection set mail <実装> か、env MAIL_PROVIDER を消す)`。出たのは実装の名前だけで、env の値そのものは出ない
- 同じ失敗の一覧に、`src/lib/mail/extensions/mail.ts` と `src/lib/mail/plugs/startupTasks/mailSelection.ts` の「宣言の無い古い一覧」の 2 行も出た(FINDINGS F3)

## 1 回で merge した時(d7、直していない)

- 写しの捨てる枝で `9bf6bb4f2` から `git merge --no-ff 996dfa154` を 1 回 → 衝突は `src/wiring/startup.ts` だけ(上と同じ解き方)
- `backend-selection.json` はフォークに無かったので、上流の `{"mail":"resend"}` が初めて届いた形で入った
- `fill` → 「足りない鍵は無い(書いていない)」。sendgrid のフォークが resend を選んだまま黙って進む。区切りを backend-kit と backend-s0 に分けた理由(D30)のとおり

## next-vnx の写し(d5)

- 合流地点(`d34e46a99`)の `scripts/workflow/backend-selection/fill.mjs` の import の閉包 63 ファイル(`scripts/runner/test/lib.copyByImports.mjs` の `importedFiles` で数えた: `scripts/structure/extensions/**`・`src/lib/districtMap/**`・`src/lib/forkOwnership/**`・`scripts/runner/phases/offlineEnv.mjs`・`scan.mjs` ほか)を写しに置いた
- `node scripts/workflow/backend-selection/fill.mjs` → exit 2、「backend-selection: 改名の前の木(src/domains が無いか src/features がある)。先に区切り district-stage1 を /flux で取る」
- 置いた後と流した後の `git status --porcelain` は同じ。`backend-selection.json` は作られていない(道具は木を変えなかった)

## 記録の置き場(d6)

- このファイル

## FINDINGS(この注文では直さない)

- F1: 固有型のファイルを届いた時のまま持つフォークでは、上流がその値を変えると git は衝突させずに上流の値を入れる(`backend-selection.json` が `{}` → `{"mail":"resend"}`)。自分の版を残す決まりは人か /flux が守るしかなく、守らないと d7 と同じく sendgrid のフォークが黙って resend になる(本番の build の食い違いの止めは MAIL_PROVIDER が設定されていれば効く)。backend-s0 の notice の手順に「merge の後、`backend-selection.json` を自分の版に戻してから fill」を足すか、/flux の固有型の取り込みが分岐点と同じ自分の版も守るかを決めたい
- F2: フォークに自分の起動時の処理(`plugs/startupTasks/`)があると、生成物 `src/wiring/startup.ts` が backend-s0 の merge で衝突する。生成物なので `pnpm generate extensions` で作り直せばよいが、選択表が `{}` のまま(fill の前)だと生成器は選択表の欠けで止まり作り直せない。今回は手で両方の行を残した。notice に「startup.ts の衝突は両方の行を残して解き、fill の後に generate で確かめる」と書くか、選択表の欠けがあっても他の一覧を書く道を作るか
- F3: build の段で食い違いの止めが出ると、選ぶ点の生成物が出力から外れるので、検査が同じ失敗の一覧で `src/lib/mail/extensions/mail.ts`・`mailSelection.ts` を「宣言の無い古い一覧」と出す(誤り。消すべき物ではない)。`check.mjs` が問題のある時も strays を数えるため。問題がある時は選ぶ点の生成物を strays から外すのが筋
- F4: backend-kit の required_action「backend-selection.json を自分のファイルとして commit する」は、フォークに無いファイルが merge の中で上流の版 `{}` として届くので、別の commit にする物が無い。notice の文を「merge で届いた `{}` がそのまま自分の版になる。fill は何も書かない」に合わせたい
