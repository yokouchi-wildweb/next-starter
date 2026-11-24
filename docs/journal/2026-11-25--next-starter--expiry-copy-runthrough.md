# 2026-11-25 区切り ratelimit-count-fix・expiry-move の道具の写しの通し(フォーク 5 つ)

> owner: next-starter

注文 22(DONE_WHEN d1〜d3 + AMENDMENT 1)の記録。フォーク 5 つの使い捨ての写しで、合流地点の 2 つの notice の道具を走らせた。確かめたのは、道具が notice のとおりに聞き、書き、止まるかどうか。道具は直していない(この回は走らせるだけ)。env のファイルは読んでいない。DB に触れず、アプリも起動していない。

## 前提

- 写し: scratch の下に、普通の `git clone <フォークの道> <scratch>/<名前>` で作った。フォークに `git worktree add` はしていない。本物の checkout も触っていない。終わりに写しは全部消した
- フォークと HEAD: 88-base `8f95089d9` / TriQ `bbdc257b0` / boardgame-site `1de2cd30a` / next-vnx `121ca04f2` / oripa-do `2b08709da`
- 道具: 合流地点 `g2/20261124-161115/junction` `4719b4605` の `.notices/20261125-025737-ratelimit-count-fix.mjs` と `.notices/20261125-033721-expiry-move.mjs`
  - 写しを cwd にして、絶対の道で `node <合流地点>/.notices/<道具>.mjs …` と走らせた(typescript は合流地点の node_modules から読まれる)
- 写しの前進のさせ方
  - 改名前の 4 つ(88-base・TriQ・boardgame-site・next-vnx)は、まだ `src/features`・`src/config/features` の置き場にある
  - そこで、前の区切りの道具 `.notices/20261122-180722-district-stage1.domains-rename.mjs` を写しの中で走らせて、改名後の置き場にした(dry-run → `--apply`)
  - 写しを進めたのはこの道具だけで、間の区切りを全部取り込んではいない。2 つの道具が読む道は改名後の `src/config/domains`・`src/app/api/cron`・`src/domains/core` だけなので、段 2・段 3 の道具は要らなかった
  - 改名の `--apply` は 4 つとも exit 0。例: boardgame-site は移動 3 件(`src/features → src/domains` 2963 ファイル、`src/config/features → src/config/domains` 32 ファイル、札 39 ファイル)、書き換え 3850 ファイル、止めた物 164 件(lone 155 ほか。道具の流れでは人が片付ける物で、この 2 つの道具には関わらない)

## 改名前の置き場のまま走らせた時(参考)

改名前の 4 つの写しで、改名の前に 2 つの道具を走らせた出力。

- ratelimit-count-fix: `src/config/domains/rateLimit.config.ts が無い: 聞く物なし`(exit 0)
- expiry-move: boardgame-site だけ `wallet-lots-prune: src/domains/core/wallet/plugs/expiryRules/walletLotsPrune.override.ts に enabled: false を書く(--apply)`、ほかは `書く物なし`

区切りは順に取り込むので、フォークが改名の前にこの 2 つを走らせることは無い。ただ、置き場の無い時に黙って「聞く物なし」で通る形だとは分かった(FINDINGS F2)。

## ratelimit-count-fix(d1)

### 5 つの写しの dry-run(改名の後)

- 88-base・TriQ・next-vnx: `聞く物なし(fork が足した・値を変えたカテゴリで、答えていない物は無い)`(exit 0)。設定は上流の空の上書き `export default {}`
- oripa-do: 自分で足した 2 つを聞いた(exit 0)

```
winReportVerify: maxRequests 5(自分で足したカテゴリ) → 今と同じにする(maxRequests を 1 減らす: 4)/ そのまま(1 回多く通る)
userItemRollback: maxRequests 20(自分で足したカテゴリ) → 今と同じにする(maxRequests を 1 減らす: 19)/ そのまま(1 回多く通る)
答え: node .notices/20261125-025737-ratelimit-count-fix.mjs --apply winReportVerify=same|keep userItemRollback=same|keep
```

- boardgame-site: 止まった(exit 2)。何も書いていない(FINDINGS F1)

```
止めた: signupEmail.maxRequests が数の字面でない
```

  その設定は次のとおりで、`adminSetup`(上流の 10 から 5 へ変えた)も聞かれないまま止まる。

```ts
export default {
  signupEmail: { maxRequests: isDevelopment() ? 100 : 7 },
  adminSetup: { maxRequests: 5 },
} satisfies RateLimitOverride<Extra>;
```

### 足した・変えたカテゴリを置いて聞く物を確かめた(88-base の写し)

足したカテゴリと値を変えた上流のカテゴリが両方そろう写しは無かった(oripa-do は足しただけ)。そこで 88-base の写しの設定に、次の物を書いた。

- Extra の `partnerApi`(4 回)と `oneShot`(1 回)
- 上流の `login` を 5 から 8 へ
- 窓だけ変えた `apiGeneral`
- 上流と同じ値の `passwordReset`(3 回)

dry-run の出力は次のとおりで、聞いたのは `login` と `partnerApi` の 2 つだけだった。値 1 の `oneShot` は「変わらない」と出て聞かれず、窓だけの `apiGeneral` と上流と同じ値の `passwordReset` は並ばなかった。

```
login: maxRequests 8(上流の 5 から変えた) → 今と同じにする(maxRequests を 1 減らす: 7)/ そのまま(1 回多く通る)
partnerApi: maxRequests 4(自分で足したカテゴリ) → 今と同じにする(maxRequests を 1 減らす: 3)/ そのまま(1 回多く通る)
oneShot: maxRequests 1(自分で足したカテゴリ) → 変わらない(1 回のまま)
答え: node .notices/20261125-025737-ratelimit-count-fix.mjs --apply login=same|keep partnerApi=same|keep
```

`--apply partnerApi=same login=keep` は exit 0 で、書き換わったのは数字の直後だけだった。

```
partnerApi: maxRequests 4 → 3(今と同じ回数)
login: maxRequests 8 のまま(1 回多く通る)
```

```ts
  login: { maxRequests: 8 /* ratelimit-count-fix: keep */ },
  partnerApi: { windowSeconds: 60, maxRequests: 3 /* ratelimit-count-fix: same (was 4) */ },
```

2 回目は何も変えなかった。dry-run は `聞く物なし` と出して、`login: 済み(keep)` と `partnerApi: 済み(same)` を並べた。同じ答えで `--apply` をもう一度流すと `書く物なし(済み・聞かない行だけ)` と出て、ファイルは 1 回目の後とバイトまで同じだった。

## expiry-move(d2・d3)

### boardgame-site の写し(d2)

- dry-run: `wallet-lots-prune: src/domains/core/wallet/plugs/expiryRules/walletLotsPrune.override.ts に enabled: false を書く(--apply)`(exit 0)
- `--apply`: `… に enabled: false を書いた`(exit 0)
  - 写しの変わった所(`git status` の前後の差)は、この 1 ファイルの追加だけだった
  - 移さない 3 本(wallet-expire-lots・expire-pending-purchases・wallet-expiration-notice)の `task.override.ts` には何も書いていない
- 書いた中身:

```ts
// src/domains/core/wallet/plugs/expiryRules/walletLotsPrune.override.ts
// 旧 cron wallet-lots-prune を task.override.ts の disabled: true で止めていたので、移った項目も止める(.notices/20261125-033721-expiry-move.mjs が書いた)

import type { ExpiryRule } from "@/lib/cron/points";

export const override = { enabled: false } satisfies Pick<ExpiryRule, "enabled" | "batchSize">;
```

- 2 回目: dry-run も `--apply` も `wallet-lots-prune: 済み(… は enabled: false)` と出した(exit 0)。`git status` は 1 回目の後と同じだった
- この写しは区切り expiry-move を取り込んでいないので、隣に項目 `walletLotsPrune.ts` は無い。本物のフォークは取り込みの merge の中で走らせるので、項目と上書きがそろう
- 88-base・TriQ・next-vnx・oripa-do の dry-run は `書く物なし(旧 cron を disabled で止めていない)` だった(上の調べのとおり、disabled を持つのは boardgame-site だけ)

### 個人情報の項目の旧 cron を止めた時(d3)

boardgame-site の写しに `src/app/api/cron/audit-log-prune/task.override.ts`(`{ disabled: true }`)を足した。dry-run も `--apply` も exit 2 で次の出力を出し、`git status` は前後で同じだった(何も書いていない)。

```
止めた(何も書いていない): audit-log-prune を止めているが、移った項目 auditLog/auditLogPrune は個人情報の削除(pii: true)で上書きで止められない。止めたままにするなら upstream へ /order(理由を書く)、動かすなら src/app/api/cron/audit-log-prune/task.override.ts を消す
```

## 後片付け

- 写しは全部消した
- フォーク 5 つの本物は、どれも `git status` が空で、HEAD は上の SHA のまま
- `git worktree list` の行の数は 88-base 1・TriQ 14・boardgame-site 11・next-vnx 1 で、始める前と同じだった
- oripa-do だけ 19 から 20 に増えた。足されたのは別のチームの worktree(`oripa-do.wt-rr2-mesa-*` の 1 つ)で、この通しの命令は oripa-do に clone 以外をしていない

## F1 の直し(D61)と boardgame-site の写しでの確かめ

F1 は評議会の決定 D61 で次の形に直した(注文 23)。

- 道具の動き
  - maxRequests が数の字面でない行(式・呼び出し・名前)では止めない。dry-run は「手で見る: <名前>(<字面>)」と並べて exit 0 で終わる
  - その行には印を付けないので、何度流しても並ぶ
  - 字面の行は今までどおり聞く(足した・値を変えたカテゴリだけ。値 1 は聞かない)
  - `--apply` で手で見る行の名前を答えると、「手で直す行」と出して止まる(exit 2、何も書かない)。ほかの止め方は変えていない
- notice の手の手順: 手で見る行は人が自分で直す(今と同じ回数にするなら 1 減らす)。required_actions に書く
- 置き場: 区切り ratelimit-count-fix の中、その notice の前に置いた(道具の直し `01b82eccd`、合流地点の merge `30404b868`、notice `c1a8ee4ce`)。後の区切りは合流地点の上で積み直した

確かめは J33 の写しの出力をそのまま写した(流し直していない)。写しは boardgame-site `1de2cd30a` の普通の `git clone` で、段 1 の改名の道具を dry-run → `--apply` してから(どちらも exit 0)走らせた。

- dry-run(exit 0)

```
手で見る: signupEmail(isDevelopment() ? 100 : 7)
adminSetup: maxRequests 5(上流の 10 から変えた) → 今と同じにする(maxRequests を 1 減らす: 4)/ そのまま(1 回多く通る)
答え: node .notices/20261125-025737-ratelimit-count-fix.mjs --apply adminSetup=same|keep
```

- `--apply adminSetup=same`(exit 0): `adminSetup: maxRequests 5 → 4(今と同じ回数)`
  - ファイルの行は `adminSetup: { maxRequests: 4 /* ratelimit-count-fix: same (was 5) */ },` になった
  - `signupEmail` の行はそのままだった
- 2 回目の dry-run(exit 0): `聞く物なし` / `手で見る: signupEmail(isDevelopment() ? 100 : 7)` / `adminSetup: 済み(same)`
- `--apply signupEmail=keep`(exit 2): ファイルはバイトまで同じだった

```
止めた(何も書いていない): signupEmail は手で直す行(maxRequests が isDevelopment() ? 100 : 7)。道具は書かない: 今と同じにするなら自分で 1 減らす
```

- 後片付け: 写しは消した。boardgame-site の本物は HEAD `1de2cd30a`、`git status` は空、worktree は 11 のままだった

## FINDINGS

- F1(bug:this-build): ratelimit-count-fix は、値を変えたカテゴリが式で書かれていると(boardgame-site の `signupEmail: { maxRequests: isDevelopment() ? 100 : 7 }`)、`止めた: signupEmail.maxRequests が数の字面でない` で exit 2 になる
  - 止まるのは道具の頭の注のとおりだが、同じファイルの字面の行(`adminSetup: { maxRequests: 5 }`、上流 10)も聞かれない
  - notice の required_actions は、exit 2 の時に人が式の行を自分で直すこと(または字面にしてから流し直すこと)を書く必要がある
  - 実在のフォークのうち 1 つがこの形にあたる
  - 解決: D61 の直しで止まらなくなった。式の行は手で見るに並び、字面の行は聞かれる(上の節「F1 の直し(D61)」)
- F2: ratelimit-count-fix は `src/config/domains/rateLimit.config.ts` が無いと `聞く物なし` で exit 0 になる
  - 区切りの順に取り込めば起きない。ただ改名前の置き場で走らせても気づけない形になっている
- F3: 改名前の 4 つは、2 つの道具が読む置き場に、前の区切りの改名の道具を流してから届いた。その道具は exit 0 で、止めた物(lone ほか)を残す。これはその区切りで人が片付ける物で、この 2 つの道具の出力には影響しなかった
