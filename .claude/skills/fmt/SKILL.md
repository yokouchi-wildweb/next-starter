---
name: fmt
description: Formats for writing that reaches the user - brief = tell a situation / ask = have the user decide / flux-stop = the report when /flux stops; read one and use it when you feel it is needed | When a reply should follow one of these formats, or the user types /fmt NAME to redo the previous reply in that format
argument-hint: "[brief | ask | flux-stop]"
---

role: a format = knowledge of how to write so it reaches the reader, not a rule | whether to use one is judged on the spot (only /flux makes flux-stop mandatory in its steps)

## LIST
- brief (brief.md): only telling a situation, no reply wanted
- ask (ask.md): having the user decide
- flux-stop (flux-stop.md): /flux stops and waits for a reply, and the final report

## BEHAVIOR
- `/fmt <名前>`: read that format file and redo **your own previous reply** in that format | no new investigation or work | content unchanged, only arrangement and selection change | information the format asks for is missing from the previous reply → do not fill it, write `不足` (missing)
- `/fmt` (no args): show the list above and end
- adding / fixing a format → read README.md (how to write format files)
