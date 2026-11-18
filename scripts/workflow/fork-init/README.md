# scripts/workflow/fork-init(pnpm workflow fork-init)

## Overview

fork した直後のリポを、答えのファイル 1 つから確認なしで初期化する命令。聞くのと承認を取るのはスキル `/fork-init`(会話と入口)で、この命令は聞かない。手順ごとに「済みか」を今のリポから判定するので、何度走らせても同じ結果になり、途中で止まっても走らせ直せば残りから書く。

## Usage

```bash
pnpm workflow fork-init plan  --answers=<答えの JSON> [--no-push] [--json]   # 書く物を手順ごとに見せる(何も書かない)
pnpm workflow fork-init apply --answers=<答えの JSON> [--no-push] [--json]   # 済みでない手順を順に書く(commit と push まで)
```

- 終了コード: 0 = 見せた・書いた(書く物が無かった時も)/ 1 = 答えの誤り・前提の不足(何も書かない、理由を全部出す)/ ほか = 途中の手順の失敗(走らせ直すと残りから)
- `--no-push`: push の手順を外す(テストと、push を後に回す時)

## API

答えの JSON(スキル `/fork-init` が会話から書く):

- `repo_id`(必須): 小文字・数字・ハイフン。今の repo.json の名(fork 元)・`src/lib/CATALOG.md` の節・`.notices/applied/` の台帳の名・手元のリポと受信箱の名(`mailbox.mjs name-check`)と重ならないこと
- `tier`(必須): `leaf` | `middle`(下流の fork を持つ・予定なら middle)
- `origin`(必須): 新しいリポの URL(GitHub のリポを作るのはスキル)
- `overview`(必須): サービスの 1 行の説明(project.md の `type:`)
- `package_name`: package.json の name(省略 = repo_id)
- `agent`: repo.json の `agent.<種類>` の上書き(例 `{ "db_push": "off" }`、鍵と値は repo.json の読み手の決まり)
- `features`: `{ "<規則名>": true | false }`(`src/featureGate/rules/<名>.ts` がある物だけ)
- `business`: 事業の素性の値の一部(例の値 `src/lib/business/examples/business.ts` にある鍵だけ。残りは例の値)
- `vercel_plan`: `hobby` | `pro`(省略 = hobby)

書く物(この順。済みの手順は飛ばす):

| 手順 | 書く物 | 済みの判定 |
| --- | --- | --- |
| remotes | 今の origin → upstream、origin = 答えの URL | upstream があり origin が答えの URL |
| repo-json | `repo_id`・`tier`・`agent.*`(`repo-json/lib.mjs` の setValue) | 全部の値が答えと同じ |
| ledger | `.notices/applied/<名>.md` の始めの行(`upstream:` = 親の取り込んだ版) | ファイルがある |
| catalog | `src/lib/CATALOG.md` の末尾に `## <名>` | 節がある |
| package-json | `name` | 同じ |
| business | `src/business/business.ts`(例の値 + 答え、`source: "own"`) | 既に own(後で直した値を消さない) |
| feature:<名> | `pnpm ops features set <名> on|off` | 命令が同じ値なら書かない |
| env | `.env.development`(`pnpm ops setup env`、コミットに入れない) | ファイルがある |
| vercel | `pnpm generate cron -- --plan <plan>` | 命令が同じ中身なら書かない |
| project-md | `.claude/rules/project.md` を雛形 `project.template.md` から(見出し overview / tier_only / maker の 3 つ、埋まらない所は TBD) | 親の版でない(自分の版は触らない) |
| commit | `chore: <名> フォーク初期設定`(上の物だけ、`.env.*` は入れない) | 上の物に差が無い |
| push | `git push -u origin HEAD` | 追う先が HEAD と同じ |

- `.claude/rules/behavior.md` は触らない(親の版から始めてよい、型 5 self)
- 雛形は道具の中に置く(`.claude/rules/` の下に置かない)

## Internals

- 手順は `{ id, what, state, apply }` の表(`lib.ts` の buildSteps)。plan は state を並べ、apply は state が済みでない物だけ apply する
- 今の命令(features・setup env・generate cron・mailbox name-check・git push)は子の処理で呼ぶ(Runner)。テストは記録だけの Runner に差し替える

## Verification

- `pnpm test scripts/workflow/fork-init`(作り物の親を clone したリポで: 書く物・2 回目は書く物 0・途中で止めた後は残りだけ・自分の project.md を触らない・答えの誤り)

## Related

- スキル `/fork-init`(聞く・計画を見せる・承認 1 回・この命令・`/local-settings`・報告)
- `scripts/workflow/repo-json/README.md`・`src/lib/business/README.md`・`src/featureGate/README.md`
