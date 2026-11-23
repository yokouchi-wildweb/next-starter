---
name: reinforce
description: Call reinforcements - open a new tab without taking anyone's screen, a new plain session with Remote Control or any command such as starting a council or a team, through pnpm workflow agent-terminal open | When the user asks for a tab, a session, a council or a team, or when you judge one is needed; always tell the user in one line what opened where
argument-hint: "[--cwd=<場所>] [--name=<名前>] [-- <命令>]"
---

role: open a tab with `pnpm workflow agent-terminal open` | the processing stays in the command
source_of_truth: flags, exit codes, how a terminal without tmux is handled = scripts/workflow/agent-terminal/README.md
args: $ARGUMENTS
when: free to use: on the user's words (e.g. `応援を呼んで` `援軍` `レインフォース` `タブを開いて` `<議会 / チーム>を起動して`) or on your own judgment that a tab is needed | every open is told to the user (REPORT)
not_here: typing into another tab (reconnecting Remote Control included) → /intervene, never this skill

## STEPS
1. what to run:
   - a new plain session → no command (it runs `claude --remote-control <name>`) | the place = the folder named, else the current repo
   - a council, team or any other program → the exact command after `--`, as named or as its own docs give it (this skill knows no team; a launcher that needs a picker cannot pick here → give it its arguments)
2. run `pnpm workflow agent-terminal open [--cwd=<dir>] [--name=<name>] [-- <command…>]`
3. exit 3 → it opened nothing: show the printed line the user types themselves
   - exit 4 → the tab opened but its command failed at once: never say it opened | show the printed screen lines and the exit, then fix the arguments (e.g. the id) and open again, or tell the user
   - exit 0 with `命令がすぐ終わりました` → the command ended at once with exit 0 (a launcher that does not attach): report it with its last lines
4. REPORT, always, also when you opened it on your own judgment

## REPORT
```
<何を>を開きました — <開いた所>(見る: <attach の命令>)
```
- failed at once (exit 4): `<何を>の起動がすぐ失敗しました(exit <n>) — <画面の最後の行>`
