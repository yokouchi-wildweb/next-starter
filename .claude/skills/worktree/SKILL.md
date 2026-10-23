---
name: worktree
description: ワークツリーを切る・env を入れ直す・片付ける。ユーザーが「ワークツリーで」「worktree を切って」などと明示したときだけ使う(並行作業に便利そうでも自分から提案・実行しない)。処理は pnpm worktree:* に任せ、このスキルは判断と段取りだけを持つ
argument-hint: "[new <やること or ブランチ名> | sync [path] | remove <path>]"
---

ワークツリーの作成・env の入れ直し・片付けを、`pnpm worktree:*` コマンドで行います。
コマンドの仕様・注意点は `scripts/worktree/README.md` が正。ここに git の手順を書き足さない(処理はコマンド側だけに置く)。

引数: $ARGUMENTS

## 共通
- `git worktree add` / `git worktree remove` を直接打たない。必ず `pnpm worktree:*` を使う(env の複製・install・安全確認が抜けるため)
- `claude --worktree`、EnterWorktree、サブエージェントの worktree 分離は使わない(env が入らない置き場所にできるため)
- このセッション自体はワークツリーへ移らない。作ったら「新しいターミナルで `cd <path> && claude`」を案内して終える

## new(作成)
1. ブランチ名を決める
   - ユーザーが指定していればそのまま使う
   - 無ければ依頼内容から `<area>/<短い英語の説明>` を提案し、確認を取ってから作る
2. 起点: 指定が無ければ実行した場所の HEAD。main から切るべき依頼なら `--from main` を付ける(迷ったら確認する)
3. `pnpm worktree:new <branch> [--from <base>]` を実行する
4. 結果を伝える
   - 作成したパスとブランチ、複製されたファイル
   - 次の一手: 新しいターミナルで `cd <path> && claude`
   - DB は本体と共有であること(スキーマ変更を伴う作業なら、`db:push` が本体の開発 DB にも効くと一言添える)

## sync(env の入れ直し)
1. `pnpm worktree:sync <path>` を実行する(`--force` は付けない)
2. 「内容が違うため未変更」が出たら、ファイル名を示し、上書きしてよいか確認する。了承があれば `--force` で再実行

## remove(片付け)
1. 対象ブランチが main へマージ済みかを確認する(`git branch --merged main` など)。未マージなら、その旨を伝えて続けるか確認する
2. `pnpm worktree:remove <path>` を実行する。未コミットの変更で止まったら、内容を示して判断を仰ぐ(勝手にコミット・破棄しない)
3. ブランチ削除(`git branch -d`)はユーザーの確認を取ってから
