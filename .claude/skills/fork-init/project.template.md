# project

<!--
  fork 用 project.md 雛形。/fork-init がコピーして <...> を埋め、.claude/rules/project.md を置き換える。
  手動でフォークする場合もこのファイルをコピーして使う。
  記述ルール: 英語・箇条書き・キーバリュー (.claude/rules/README.md 参照)。
  埋め終わったらこのコメントブロックは削除する。
-->

## overview
- name: <project name>
- type: <what the service is, one line>
- repo: <origin url> (origin) | upstream: <upstream url>
- phase: <experimental | pre-launch | production>. <real users yes/no>

## TIER (multi-tier hierarchy)
this_repo: Tier<N> (direct fork of <upstream name> = Tier<N-1>). <no Tier<N+1> downstream planned for now | downstream forks: ...>
rule: generic/foundational capabilities (domain-independent infra, UI primitives, CRUD base, auth) live in Tier1. do NOT hardcode them here — file /upreq instead. <domain> code lives HERE
request_protocol (shared mailbox: ~/.team/upstream-requests/):
- file a generic-capability request with /upreq
- track own requests with /wen
- receive upstream notices with /flux (ledger: .notices/applied/<fork-id>.md)

## backend_status
- firebase: <configured | NOT configured (env empty). auth / storage / firestore paths are inactive>
- neon: <configured | NOT configured (DATABASE_URL empty). DB-backed pages (admin, user domains) are inactive>
- implication: <e.g. first tools are browser-complete (client-side state only). do NOT add server persistence until backend is set up>

## direction
- <how the product grows, 1-3 lines>

## domains (priority order, one feature dir each under src/features/)
1. <domainName> (FIRST): <what it does>
2. <domainName>: <what it does>
- <TBD if not decided yet>

## dev_rules
- <project-specific conventions: display components, canonical internal representations, naming. empty is fine at start>
