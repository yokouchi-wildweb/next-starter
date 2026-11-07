---
name: route-map
description: ルート地図(全ページの守りの鎖 = page → Screen → loader の access → guard.ts)を見せて説明する。「admin のページを guard ごとに」「公開ページの一覧」「止めているページ」「図で」など、ページの守り・範囲・公開状態を聞かれたときに使う。地図は pnpm check routes -- show に描かせ、このスキルは依頼を引数に直すことと結果の説明だけを持つ
argument-hint: "[見たいもの(例: admin を guard ごとに / 公開ページを表で / /mypage 配下を図で)]"
---

ルート地図を `pnpm check routes -- show` で絞り込んで描き、その結果を説明します。
地図の形・読み方・オプションの仕様は `src/lib/screens/README.md` §13 と `pnpm check routes -- show --help` が正。

依頼: $ARGUMENTS

## 守ること
- 地図は CLI に描かせる。`src/app/route-map.jsonl` を自分で開いて数えたり並べ替えたりしない(正しさは CLI とそのテストが持つ)
- 地図は直さない。地図は生成物で、変えるのはページ・loader・guard.ts の側(直すかどうかは人が決める)
- `--file` を付けない限り、表示は src/app から作り直した値(コミット前の変更も映る)

## 1. 依頼を引数に直す
| 依頼の言い方 | 引数 |
|---|---|
| 全部 / 一覧 | (なし。多ければ `--view=table`) |
| ◯◯ 配下(URL) | `<URL 接頭辞>`(例 `/mypage`) |
| guard ごと / 範囲ごと / 構造 | `--view=tree`、図なら `--view=mermaid` |
| 管理画面の範囲 | `--scope='admin/(protected)'`(その範囲だけ = `--nearest` を足す) |
| ログイン必須の範囲 | `--scope='(user)/(protected)'` |
| 誰でも見られる / 公開 | `--access=public` |
| ログインだけで見られる | `--access=authenticated` |
| 管理者だけ / ロール ◯◯ | `--access=category:admin` / `--access=role:<ロール>` |
| ドメインの権限に任せている | `--access=registry`(ドメインを絞るなら `--access=registry:<domain>`) |
| 停止中・BAN 等の状態でも入れる | `--access=statuses` |
| 止めている / 404 のページ | `--state=gated-off` |
| 表で / 図で / ツリーで | `--view=table` / `--view=mermaid` / `--view=tree` |

- 同じオプションを重ねると OR、別のオプションどうしは AND
- `(` `)` `@` を含む値(範囲・URL)はシェルで `'…'` で囲む
- 依頼が曖昧なら既定は `--view=table`。範囲の名前が分からなければ、先に `pnpm check routes -- show --view=tree` で範囲(scope=)を見る
- mermaid は全ページだと大きい。範囲か URL 接頭辞で絞ってから出す。描いた結果は ```mermaid のコードブロックでそのまま見せる

## 2. 実行する
`pnpm check routes -- show <引数>` を 1 回実行する(表示を変えるなら引数を変えてもう 1 回)。
- exit 2 = 引数の誤り。出た説明を見て直す
- exit 1 = 鎖が読めないページがある(✗ の行)。地図は描けないので、その行をそのまま見せ、直す場所(行の file)と `pnpm generate routes` で確かめられることを伝える(規則: README §13「生成失敗」)
- `! 地図が古い` の行 = コミットされた地図が src/app とずれている。表示は今の src/app の値。コミットするなら `pnpm generate routes` で作り直すよう伝える

## 3. 説明する
出力をそのまま貼るだけで終えない。依頼に答えたうえで、次に当たるものがあれば挙げる(なければ「気になる点なし」):
- **思わぬ公開ページ**: access=public で、page dir(表の列)が `(user)/(public)`・`(marketing)`・`(user)/(auth)`・`(user)/(legal)` の外にあるもの(例 demo、admin/login・setup のような入口は意図どおりかを一言添える)。公開でよいかは人が決める
- **止めているページ**: gated-off(feature-gate の規則で 404)。フラグを戻すと即公開されるので鎖が正しいかも見る
- **registry**: ドメインの serviceRegistry の access に任せている管理画面。広さはそのドメインの domainEntry.ts で決まる
- **statuses**: allowStatuses で、通常は弾く状態のユーザーも入れるページ
- 範囲(scope)と loader の access の組み合わせ: 親子は AND なので、loader が広く書いてあっても範囲より広くはならない。範囲より狭い loader(例 管理範囲の中の role:admin)はそのページだけの絞り込み

説明は日本語で短く。ページの数は CLI の出力の行から数え、推測しない。
