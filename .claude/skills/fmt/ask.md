# ask
when: having the user decide
not: no reply needed (→ brief) | several questions (→ one at a time; 1by1 of shortcuts) | /flux approval (→ flux-stop)

reader_goal: from this text alone, the reader can choose without scrolling back through the exchange

## STRUCTURE (section name | required|optional | role)
`背景` (background) | required | what this is about; the premises needed to decide
`問題` (problem) | optional | why the decision became necessary
`体験のイメージ` (experience) | optional | how the user's screen / behavior changes with the choice
`質問` (question) | required | what to decide; one question per sentence
`選択肢` (options) | required | show one recommendation | each option in a form that tells what happens when chosen

## GUIDELINES
- give the reason for the recommendation | a non-recommended option with a reasonable case for choosing it → write that case
- make the reply a one-word label (A / B, `はい` / `いいえ`)
- missing information stalls the decision, extra information delays it | both are the same failure
- call files, commits and identifiers by their role, not their name | give identifiers when asked
- write plain text (so it can be answered even through a text-only channel)

## EXAMPLE
```
ユーザー名の一意性チェックを、登録時だけでなく変更時にも効かせる作業です。
いまは変更画面から同名に変えられてしまい、一覧で区別が付かなくなります。

変更時の重複をどう扱いますか?
A(推奨): 登録時と同じ規則で拒否する。挙動が一貫し、既存の共通スキーマをそのまま使える
B: 警告だけ出して許す。既に重複している利用者を締め出さずに済むが、一覧の混乱は残る
```
