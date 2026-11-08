# brief
when: only telling a situation, no reply wanted (results of an investigation, the situation when stopped, sharing "this is where things are now")
not: the reader has something to decide at the end (→ ask) | /flux stopping (→ flux-stop)

reader_goal: from this text alone, the reader grasps what is happening and why

## STRUCTURE (section name | required|optional | role)
`背景` (background) | required | what this is about; the premise the reader needs to place it
`問題` (problem) | optional | what is in trouble now, what is not normal
`体験のイメージ` (experience) | optional | how it looks on the user's screen / in behavior

## GUIDELINES
- call files, commits and identifiers by their role, not their name (e.g. `画面の有効/無効を決める設定`) | give identifiers when asked
- write where things are now, not the history | history needed → add it as the reason that explains the current state
- optional sections only when leaving them out changes the reader's grasp | never write to fill
- the text naturally ends with "what shall we do?" → it is an ask

## EXAMPLE
```
ログイン後のリダイレクト先が、設定した値ではなくトップに戻っています。
原因は、ログイン画面の保護範囲の設定が、上流の新しい方式に合わせて直した際に、fork 独自の戻り先の指定を読まなくなったためです。
いまの本番では、ログイン直後に必ずトップが表示され、元いたページには戻りません。
```
