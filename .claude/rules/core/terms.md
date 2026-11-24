---
paths:
  - "CLAUDE.md"
  - "AGENTS.md"
  - ".claude/rules/**"
  - ".claude/skills/**"
---
# terms
> **ROLE**: loaded when writing context (CLAUDE.md, AGENTS.md, .claude/rules/, .claude/skills/) | holds the term table: one meaning per word, English is the canon
> Tier1-owned: forks never edit (gap → /order next-starter)
> **GENERATED**: generated file, never edit by hand | source scripts/workflow/terms/terms.json | regenerate with pnpm generate terms

use: write these words with these meanings | `-` = no Japanese word decided | the wrong paraphrases are stopped by pnpm check terms (phase ship)

- district: 地区 | 一つの性質を持つまとまり(名前空間・増設点・持ち主の単位)。開閉の軸ではない
- district kind: 地区の種類 | 地区の種類(domains・lib・frame・featureGate・registry・wiring・proxies)。kind を単独で使わない
- featureGate: 門番 | 機能の定義を持ち、ドメインを開け閉めする唯一の地区
- gate: - | 門番の API の入口の名前だけ(gate.enabled・useGate・gate.path・GateProvider)。検査の段には使わない
- feature: 機能 | 門番の開け閉めの単位(規則 1 つ)だけ。ドメインの意味では使わない
- domain: ドメイン | 業務の概念の単位 = src/domains/<domain>(ゲートを持つ唯一の地区の種類)
- application: アプリ | 1 つのリポで動く物(app は src/app に残る名前)。街は説明の比喩で識別子に入れない
- framework: フレームワーク | Tier1 が配る、アプリの設計図
- region: 区画 | fork が親のファイルに書ける範囲(可変域の 1 行がファイルの一部を指す時)
- skeleton: 骨組み | proxies の鎖の上流の手書きの並び(旧: 枠)
- extension point: 拡張点 | 5 つの変え方の 1〜4 で上流が宣言した点の総称(差替点・上書点・増設点・対置点)
- replace: 差替型 | 変え方 1: 持ち主の既定を fork の版に差し替える
- override: 上書型 | 変え方 2: 宣言されたキーだけを上書きする(旧: overlay)
- add: 増設型 | 変え方 3: 増設点に項目を足す
- counterpart: 対置型 | 変え方 4: 持ち主のファイルと対になる場所に自分の版の値のファイルを置く(src/config の設定値・根の CSS、旧: placement)
- self: 固有型 | 変え方 5: 各リポが自分の版を持つファイル
- CHANGE_TYPES: 変更形式 | 親が持つ物を fork 側で変える、ただ 5 つの方法(差替型・上書型・増設型・対置型・固有型)。どこを変えてよいかは持ち主が宣言する
- replace point: 差替点 | ちょうど 1 つ要る点(常設のドメインが既定を差し、fork は差し替える)
- override point: 上書点 | 上書型で宣言された点(上書きしてよいキー)
- receptacle: 増設点 | 0 個以上の項目を並べる点(旧: 受け口)。型 = 変え方、点 = 上流が宣言した場所
- counterpart point: 対置点 | 対置型で宣言された点
- intake: 可変域 | fork が親の物を変えてよい所の全部(拡張点 ⊂ 可変域)
- plug: - | 差す側の手書きの項目 <ドメイン>/plugs/<点の名前>/<名前>.ts(増設点 receptacle と対。extensions/ は持ち主の側の生成された一覧)。日本語は指示書の議会が決める
- phase: 段階 | 検査と生成をまとめて回す段(build・build:post・ship・forge:pre・forge:post・deploy・nightly)。--phase・phase.json
- config values: 設定値 | src/config の値のファイル
- core: core | Tier1 が配って持つ物の 1 義
- always-open: 常設 | どの機能も載せない、常に開いたドメイン(明示の宣言)
- base: 分岐点 | 親との merge-base だけ(常設の意味では使わない)
- backend selection table: バックエンドの選択表 | 根の backend-selection.json(固有型): 口の名前 → 口の全部の選ぶ点が選ぶ実装の名前。命令が書き、生成器と検査だけが読む
- selecting point: 選ぶ点 | 口(port)の実装を選択表の名前で 1 つ選ぶ増設点(port: を名乗る。点が 1 つの口は点 = 口)
- capability name: 能力の名前 | <口>.<語>。口の実装の provides・requires に書く名前(語は口の持ち主の選ぶ点の宣言と増設点 backendCapabilities が持つ)
