# Codex のスキル共有

スキル定義の原本は `.claude/skills/` に置く。`.agents/skills` はそのディレクトリへのシンボリックリンクで、定義を複製しない。Claude 側でスキルを追加・変更すると、Codex が次にスキルを探索するときに反映される。表示が更新されない場合は Codex を再起動する。

既存の `SKILL.md` 本文と frontmatter は変更しない。`$ARGUMENTS`、`!`、Claude 固有のツール名などは、Codex で同じ動作をするとは限らない。個々のスキルの読み替え方は後で検討する。

Claude 側で自動起動を禁止している `downreq`・`ebb`・`flux`・`fork-init` には、Codex 専用の `agents/openai.yaml` で自動選択を禁止する設定だけを追加した。このファイルは Claude のスキル指示を変更しない。Codex から明示的に選ぶことはできるが、特に Claude の auto-memory を扱う `ebb` は、対応方法を決めるまで Codex で実行しない。

新しいスキルも自動的に Codex の探索対象になる。Claude 固有の操作や起動制限を持つスキルを追加した場合は、Codex での扱いを個別に確認する。

Codex の探索先と起動設定については [OpenAI のスキル資料](https://learn.chatgpt.com/docs/build-skills)を参照する。
