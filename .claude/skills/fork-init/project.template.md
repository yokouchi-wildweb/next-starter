# project

<!--
  fork 用 project.md 雛形。/fork-init がコピーして <...> を埋め、.claude/rules/project.md を置き換える。
  手動でフォークする場合もこのファイルをコピーして使う。
  記述ルール: 英語・箇条書き・キーバリュー (.claude/README.md 参照)。何を書くかは CLAUDE.md 冒頭の PER_PROJECT。
  埋め終わったらこのコメントブロックは削除する。
-->

## overview
- name: <project name>
- type: <what the service is, one line>
- repo: <origin url> (origin) | upstream: <upstream url>
- phase: <experimental | pre-launch | production>. <real users yes/no>
- direction: <how the product grows, 1-3 lines>

## TIER (multi-tier hierarchy)
this_repo: Tier<N> (direct fork of <upstream name> = Tier<N-1>). <no Tier<N+1> downstream planned for now | downstream forks: ...>
rule: generic/foundational capabilities (domain-independent infra, UI primitives, CRUD base, auth) live in Tier1. do NOT hardcode them here — file /upreq instead. <domain> code lives HERE
request_protocol (shared mailbox: ~/.team/upstream-requests/, one inbox per receiving repo):
- file a one-off order into any repo's inbox, or into this repo as a next task, with /order <self|repo> (/upreq = alias). generic → Tier1, <domain>-specific → the tier that owns it
- check the orders filed in the current session with /wen
- handle orders addressed to this repo with /inbox (judge against this repo's role; relay what another repo owns)
- receive upstream notices with /flux (ledger: .notices/applied/<fork-id>.md)

## backend_status
- firebase: <configured | NOT configured (env empty). auth / storage / firestore paths are inactive>
- neon: <configured | NOT configured (DATABASE_URL empty). DB-backed pages (admin, user domains) are inactive>
- implication: <e.g. first tools are browser-complete (client-side state only). do NOT add server persistence until backend is set up>

## architecture_delta (ONLY where this fork differs from upstream CLAUDE.md; do not restate upstream)
- <e.g. top page = src/app/(user)/_components/<Name>/ | auth = LINE login added (features/lineAuth) | TBD if none yet>

## domains (priority order, one feature dir each under src/features/)
1. <domainName> (FIRST): <what it does>
2. <domainName>: <what it does>
- <TBD if not decided yet>

## references (where to look before working on X; pointers only, no content)
- <topic>: <path/to/README.md or doc> — <when to read it>
- <TBD if none yet>

## dev_rules (standing fork-specific rules and decision criteria; no history, no dates)
- <feature-addition criteria, external constraints (legal / API terms), display conventions, canonical internal representations. empty is fine at start>
