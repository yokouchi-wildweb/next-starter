# flux-stop
when: /flux stops and waits for the human's reply (first approval, end of a segment, stopped by a stop condition) and the final report
not: short in-progress reports while all / light runs on without stopping | decisions unrelated to /flux (→ ask)

reader_goal: from this text alone, the reader can tell where things are now, what happens next, and what to answer

## STRUCTURE (section name | required|optional | role)
`位置` (position) | required | segment k/N and its state (`承認待ち` / `停止` / `終了`) | first time: the scale (upstream commit count, notice count, segment count) and anything unusual (uncommitted changes, untraceable history, etc.)
`区間の結果` (segment result) | optional | the finished segment: one line on whether intake, application and checks went fine and it was pushed | add lines only for exceptions (kept by the human's policy, our own mistake, etc.)
`中継` (relay) | optional | every time for a fork with downstream | `あり` = what downstream must do and why | `なし` = one-word reason
`止まった理由` (why stopped) | optional | on a stop condition: what was found, evidence, the paths to choose from
`次の区間` (next segment) | optional | the object of approval (absent from the final report) | written in the 6 points below
  `変わる点` (what changes) | required | the changes intake brings to the fork | bullets, short
  `体験の変化` (experience change) | optional | only when the user's screen / behavior changes, concretely
  `fork の追従` (fork follow-up) | required | state `あり` / `なし` explicitly | `あり` = what (by role), how much (count of files / spots), what kind of work, where it may affect, an estimate of the effort (rough labor) | with `あり`, every time add the fixed line `量が多ければ、この移行を別の依頼に切り出して先へ進めます(再計画 移行は別の依頼)` at the end (never judge whether to split it out)
  `db:push` | required | state `あり` / `なし` explicitly | `あり` = what gets created / changed
  `ダウンタイム` (downtime) | required | state `要る` / `要らない` explicitly | `要る` = during which operation
  `手動のデータ移行` (manual data migration) | optional | only when something in the DB, Storage etc. is moved by hand
  `逸脱` (deviation) | optional | remedies off the standard steps (how to resolve a conflict that needs the human's policy, extra checks, etc.)
`残りの概観` (overview of the rest) | optional | number + Japanese gist + notes that matter for the decision (`区間 13 で修正される`, `移植あり`) | unchanged since last time → one line
`宿題` (homework) | optional | the notice's manual_steps | a checklist of what the human does
`上流への所見` (findings for upstream) | optional | at a segment end, only **what was newly found in this segment** + the running total (`新規 1 件、累計 3 件`) | nothing new → one line with the total only; total 0 too → omit | final report: all of them
`問い` (question) | required | add the reply vocabulary | final report: the declaration of the end and the remaining segments

## CONTRACT
- reply vocabulary: first approval = `go` / `go last` / `いいえ` | segment end = `go` / `go last` / `再計画` / `ここで終える` | in both: `再計画 移行は別の依頼` (rebuild the plan without the migration and the draft order text, then ask again; flux SKILL.md section `移行を別の依頼に切り出す`)
- work memo: what is not put in chat goes to flux's work memo | place and lifetime decided by flux SKILL.md | answer from there when asked
  - contents: script = application steps, conflict forecast, check items / decision grounds = relay criteria, excluded counts / aligned, kept_old / for resuming = sha per segment, next merge target, decisions the human made / number ↔ checkpoint label ↔ sha mapping / every upstream finding with its grounds
- vocabulary for "what kind of work" in `fork の追従`: `置き換え` (replacement: only align call names / placement) / `作り直し` (rebuild: move the fork's implementation onto the new mechanism; needs a behavior check) / `判断が要る` (needs judgment: upstream's and the fork's intents collide, some spot needs the human's decision)

## GUIDELINES
- call files, commits and notices by their role, not their name | identifiers go to the work memo
- checked and found none → do not write it (except the 3 points that must state `あり` / `なし`)
- never write the standard steps (merge → checks → ledger → commit → push) | write only deviations
- never show internal codes (info / breaking, criterion numbers, light / heavy) | the reader judges the weight from the 6 points
- where things are now, not the history | information for resuming lives in the work memo
- check results: `問題なし` (no problems) is enough | failures stop at a stop condition, so no failure arrives here

## EXAMPLE
```
区間 1/18 完了 → 2/18 承認待ち
区間 1: 取り込み・適用・検査すべて問題なし、push 済み。
  中継: あり — fork が既定を変えた画面スイッチの設定が上流の変更と重なるため、下流も自分の値を見直す必要がある。中継 notice 作成・push 済み
  こちらの誤り: 中継 notice と台帳の時刻を実時刻より 1 時間後に書いた(順序の表記だけの実害。出荷済みなので残す)

次の区間 2/18: notice に「どの依頼を解決したか」の欄を足す変更
変わる点
- notice に解決した依頼を書く欄が増え、所有の検査がそれを読んで一時許可の期限切れを判定する
- /ship・/flux の手順書が新しい欄に対応する(次の区間から新しい手順で進む)
fork の追従: なし(fork の独自コードは上流の変更に触れていない)
db:push: なし
ダウンタイム: 要らない

残り: 区間 3〜18 は前回から変わりなし

次の区間 2/18 をこの計画で進めますか?(go / go last / 再計画 / ここで終える)
```
