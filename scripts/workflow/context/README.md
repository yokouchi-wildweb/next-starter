# scripts/workflow/context(pnpm workflow context)

## Overview

- 文脈のファイル(このリポの自前の決まり、個人の 2 ファイル)の行ごとの事実を、`/project-review` と `/meditate` のために出す命令
- `facts` は 1 行 1 件で事実だけを出す(読むだけ、判断しない)。食い違いの判断・提案・書き換えはスキルの側
- 優先の印 `(priority)` と食い違いの決め方: `.claude/rules/core/design.md` priority

## Usage

```bash
pnpm workflow context facts               # このリポの自前の文脈(何も書かない)
pnpm workflow context facts --personal    # 個人の 2 ファイル: CLAUDE.local.md・~/.claude/CLAUDE.md
pnpm workflow context facts --fetch       # 持ち主を決める前に親の remote を fetch する(既定は fetch しない)
```

- 終了コード: 0 = 出した | 2 = 引数の誤り・持ち主が決まらない(fork の名前の宣言の誤り、親の版が読めない)

## API

出力:

- 1 行目 `scope: repo|personal`
- ファイルごとに `file: <path> | owner:<own|self|personal> | lines:<内容の行の数>`、続けてその行ごとに 1 行:
  `<path>:<行> | key:<鍵|-> | mark:<priority|order:<id>:<open|done|unknown>|-> | base:<path:line,…|-> | same:<path:line,…|-> | refs:<在る数>/<全数>[ gone:<無い物>] | words:<perm,env|->`
- 一覧(base・same・gone)は 3 件まで出し、それより多いと `…` を付ける

見るファイル:

- repo(fork): `pnpm workflow ownership who` が fork の物(own)か型 5 の self と答える `.claude/rules/` の物(`core/`・`items/` を除く)(`shortcuts.md` も型 5 self)、`lineage.md` の自分の節
- repo(Tier1): `core/`・`items/`・`lineage.md` を除く `.claude/rules/` の物を丸ごと(印のファイルも)
- personal: 本体のチェックアウトの `CLAUDE.local.md`(ワークツリーから走らせても本体の物)と `<CLAUDE_CONFIG_DIR か ~/.claude>/CLAUDE.md`。無いファイルは出さない

各項目の意味:

- 内容の行: 空行・frontmatter・囲みのコード(``` / ~~~)・見出し(`#`)・`<!--` の行を除いた行
- key: 行頭の鍵(`- key:` `key:` `> **KEY**:`、鍵の後ろの括弧の印は飛ばす)
- mark: `order:` = 行に `(order: <id>)`(受け箱のどれかの `<id>.md` = open、`done/<id>.md` = done、無ければ unknown)| `priority` = 行か、字下げでその行の上にある行に `(priority)`(見出しからは広げない)
- base: 同じ鍵を持つ土台の行 = `CLAUDE.md`・`.claude/rules/core/*.md`・`lineage.md` の祖先の節(personal ではこのリポの自前の文脈も)
- same: 行の字面(行頭の印を除いて 20 字以上)と同じ文字列を持つ、このリポの追跡ファイルの行(自分の行を除く。言い換えは拾わない)
- refs: 行の中のパスらしい語とコミットらしい語の実在。相対のパスはリポの根から、無ければ `.claude/rules/` から解く(`core/x.md` の書き方)
- words: `perm` = 許可に当たる語(`scripts/workflow/devcheck/lib.kinds.mjs` の種類・危険な 3 つの名前と入口の命令、`db:push`・`deploy`・`dev server`・`playwright`)| `env` = 環境の語(`production`・`staging`・`NODE_ENV`・`APP_ENV`・`.env`)

## Internals

- `lib.lines.mjs` = `pnpm workflow memory` と共有の部品(道・frontmatter・参照の実在・同じ字面・一覧の短縮)。`lib.mjs` = 見るファイル・行・鍵の索引・1 行の事実
- 持ち主は `src/lib/forkOwnership/who.mjs` の `whoOwns`(`pnpm workflow ownership who` と同じ判定)。依頼の受け箱の根は `.claude/skills/order/mailbox.mjs` の `ordersRoot`
- 何も書かない(fetch も `--fetch` の時だけ)

## Verification

- `pnpm test scripts/workflow/context/context.test.mjs`(/ship の検査が回す)

## Related

- `/project-review`: このリポの自前の文脈の棚卸し(この命令の repo の出力で)
- `/meditate`: 個人の物の棚卸し(この命令の `--personal` と `pnpm workflow memory facts`)
- `scripts/workflow/memory/README.md`: memo の事実(部品を共有)
