---
name: reinforce
description: Call reinforcements - open a new tab without taking the screen of whoever asked (a new plain session with Remote Control, or any command the user names such as starting a council or a team), or reconnect Remote Control in another tab, through pnpm workflow agent-terminal open|rc | Only when the user asks in their own words to open a tab, start a session, council or team, or reconnect remote control; never on your own judgment
argument-hint: "[open [--cwd=<場所>] [--name=<名前>] [-- <命令>] | rc <宛先>]"
---

role: open a tab or reconnect Remote Control for the user, with `pnpm workflow agent-terminal open|rc` | the processing stays in the commands
source_of_truth: flags, targets, exit codes, how a terminal without tmux is handled = scripts/workflow/agent-terminal/README.md
args: $ARGUMENTS
when: only on the user's own request | their words, e.g. `応援を呼んで` `援軍` `レインフォース` `タブを開いて` `<議会 / チーム>を起動して` `リモートコントロールをつないで` | never to split your own work or as a fallback

## OPEN
1. what to run, from the user's words:
   - a new plain session → no command (it runs `claude --remote-control <name>`) | the place = the folder they name, else the current repo
   - a council, team or any other program → the exact command they named or the one its own docs give, after `--` (this skill knows no team; a launcher that needs a picker cannot pick here → give it its arguments)
2. run `pnpm workflow agent-terminal open [--cwd=<dir>] [--name=<name>] [-- <command…>]`
3. tell the user the printed line (where it opened and the attach command) | exit 3 → it opened nothing: show the line the user types themselves

## RC
1. the target, as the user gave it: a conversation name (the same names `pnpm workflow peer who` lists) | `<session>[:<window>]` | a pane `%<N>` (`--socket=<name>` for a tmux server started with -L)
2. run `pnpm workflow agent-terminal rc <target>`
3. tell the user the printed line | exit 3 with candidates → show them; STOP: run again only for the one the user picks | exit 3 otherwise → the line says to type /remote-control in that tab

## REPORT
```
<開いた所 / 打った結果の 1 行の要点>
```
