# /flux 付属: 中継(3 段以上の Tier)

SKILL.md「付属ファイル」の条件に当たったときに読む。ここに書いた規則は SKILL.md の同名の節に**追加で**効く(SKILL.md の規則を置き換えない)。仕様: `.notices/README.md`「中継(relay)」。

## 用語と索引
- **祖父 notice** = `from:` の repo が自分の origin とも直上 upstream の URL とも一致しない notice(URL 比較は未適用判定と同じく表記差を無視)。中間 fork-id の台帳(SKILL.md「自 fork の識別と台帳」5)が無いときは祖父 notice を判定しない(従来どおり)。
- **covers 索引**: ツリー内と流入予定のすべての notice(自分の origin のものを除く)の `covers:` を読み、`covered id → covers 側 id` の対応を作る。同じ id を複数の notice が covers していたら、履歴上最も早い covers 側を採る。
- **祖父 notice の区切り点** = 中間 Tier の台帳にその id が記録された commit: `git log -S"id:<id>" --format=%H <upstream>/<branch> -- .notices/applied/<中間 fork-id>.md` の最古(`--reverse` で先頭)。台帳の `commit:` 欄は使わない。見つからなければ追加 commit を区切り点とし、計画に「中間 Tier が未適用: T1 の生 commit で区切る」と警告する。
- 祖父 notice で covered されていないものは、中間 Tier の台帳のその id の行の `relay:` 欄で分ける:
  - `relay:none` → 中間 Tier が差分で「中継不要」と判定済み(下記「中継判定」)。上流 notice をそのまま適用する(注記・写像なし)。
  - 欄が無い(旧台帳)→ 計画に「<直上 upstream> からの中継 notice なし。required_actions は中間 Tier の状態を前提に書かれている」と注記し、中間 Tier の台帳の `notes:`(その id の行)を読んで自 fork の実情へ写像する。
  - `relay:<id>` なのにその中継 notice がまだ届いていない → 中継 notice は台帳記録と同じ commit で出荷されるので通常起きない。起きたら報告に含め、欄が無い場合と同じ扱いにする。

## 未適用判定への追加
- covered 側の id は、covers 側 notice が適用済みなら適用済み。covers 側が未適用なら未適用のまま covers 側の区間に吸収される(単独では適用しない)。

## 区間の組み立てへの追加(SKILL.md の同節の番号に対応)
- 2: 祖父 notice の区切り点は通常の追加 commit ではなく、上記「祖父 notice の区切り点」(中間 Tier の台帳記録 commit)。
- 3: covered 側の notice(covers 索引にある id)を流入予定の並びから外し、covers 側 notice の区間に入れる(区切り点にしない)。covers 側が既に適用済みなら covered 側も適用済み扱い(上記「未適用判定への追加」)。covers 側がまだ届いていない祖父 notice は covered と分からないので、通常の祖父 notice として扱う(区切り点 = 中間 Tier の台帳記録 commit)。
- 5: covers 側 notice の区間には、それが covers する id も「covered」として並べる。
- 6: 区間の notice 一覧で、covered id・祖父 notice はその旨を添える。
- `moved:` の対象の組には covers 側・covered 側の両方の `moved:` を合わせる(`moved.md` 手順 0)。

## 台帳への追加(SKILL.md 手順 7a)
- covers 側 notice を記録したら、その covered id も 1 行ずつ記録する(`notes:covered by <covers 側 id>`。既に台帳にある id は重ねない)。
- `relay:` 欄は下流を持つ fork だけが書き(下記「中継判定」の結果。covered id には covers 側と同じ値)、末端 fork は欄ごと省く。

## status --chain
状態報告のみ(`status` と同じく merge も適用もしない)。祖父 notice ごとに 1 行: `<id> | 中間 Tier: applied <台帳記録 commit 短 sha> / not applied | relay: covered by <id> / none / not judged | me: applied / unapplied / inherited`(`none` = 中間 Tier の台帳が `relay:none`、`not judged` = covered されておらず台帳に `relay:` 欄も無い)。最後に、自分が中間 Tier として未判定の件数(下記「中継判定」の未判定)を 1 行。中間 Tier が無い(直上 upstream が最上流)なら「祖父 notice なし」とだけ出す。

## 中継判定(下流を持つ fork のみ)
自分が中間 Tier として、適用した上流 notice を下流へ中継する必要があるかを **git の差分だけで**機械的に決める(文面の解釈で判断しない)。
- **対象 fork**: `.claude/rules/project.md` の TIER 節に下流(Tier3 等)を持つと書かれている fork。下流が無い・予定なしと書かれていれば末端 fork として何もしない。どちらとも読めなければ平文でユーザーに尋ねる。
- **対象 notice**: 区間内で適用した notice のうち `from:` が自分の origin でないもの(祖父 notice・上流の中継 notice を含む)。covered id は covers 側と一緒に 1 件として判定する。
- **判定**(区間の手順 6 の verify 後、手順 7 の前。notice ごとに。次の ①〜③ のどれか 1 つでも当たれば中継が必要、どれにも当たらなければ `relay:none`):
  - 基準点: `Q` = その notice の区切り点(区間の組み立ての区切り点。区間 0 なら追加 commit。祖父 notice なら中間 Tier の台帳記録 commit)、`P` = 上流履歴上でその直前にある notice の区切り点(無ければ fork 成立点)、`A` = この区間の手順 5 を終えた直後の HEAD(merge コミット。fast-forward ならその到達点、区間 0 なら区間開始時の HEAD)。
  - ①② はスクリプトで出す(ハンクを手で読み比べない): `node .claude/skills/flux/relay-check.mjs --p <P> --q <Q> --applied-from <A>`。exit 0 = ①② とも該当なし / 1 = 該当あり(`overlap:` / `outside:` 行が根拠)/ 2 = エラー(停止条件として止める)。
  - **① ハンクの重なり**: 上流が P→Q で変えた行範囲と、作業ツリーが Q と食い違う行範囲が、同じファイルで重なるか接している。接触も数えるのは git の 3-way merge が衝突とみなす基準と揃えるため。上流が追加・削除したファイル、バイナリはファイル全体を範囲とみなす。同じファイルでも離れた場所にある fork 独自の追加(package.json の fork スクリプト、registry の fork エントリ等)は数えない。
  - **② 適用作業での上流変更ファイル外の変更**: `A` から作業ツリー(未追跡を含む)までに変わったファイルのうち、上流が P→Q で変えていないもの(この区間の掃討・改名など)。区間の notice すべてを該当にする(区間は通常 notice 1 件)。
  - **③ required_actions からの逸脱**: この区間で、その notice の required_actions のどれかを実行しなかった、または変えて実行した(手順 7a で台帳 `notes:` に書く逸脱そのもの)。差分の有無を問わない。逸脱が無ければ下流は上流 notice どおりの作業で済むが、逸脱があると下流は上流の手順をそのまま実行してしまうため。`covered by` や push 失敗の記録は逸脱に数えない。
  - 対象外: `.notices/` と lock ファイル(`pnpm-lock.yaml` 等。package.json から生成される派生物)は ①② で数えない。
- **中継 notice の下書き**(区間内に中継が必要な notice が 1 件以上): 区間につき 1 件、`.notices/<ts>-relay-<slug>.md` に書き出す。合成規則は `.claude/skills/downreq/SKILL.md`「relay モード」の手順 3〜4(`covers:` = この区間で中継が必要な id と、その covered id)。加えて `notes:` に判定の根拠をそのまま載せる: ① はスクリプトの `overlap:` 行(ファイルと行範囲)、② は `outside:` 行、③ は台帳 `notes:` に書く逸脱。下書きはこの区間の適用コミットに含める(中継 notice の追加 commit = 台帳記録 commit になり、下流の区切り点が一致する)。
- **台帳**: 手順 7a で各 id の行に `relay:none` か `relay:<中継 notice id>` を書く。
- **報告**: 判定した notice ごとに 1 行「<id>: 中継不要」/「<id>: 中継 notice <中継 id> を作成(根拠: ①<files> / ②<files> / ③逸脱)」。作成した中継 notice は「中身は判定根拠・台帳 notes から組み立てた下書き。下流へ出す前に確認・編集してよい」と添える。
- **判定の限界**(機械判定のため): ② は notice の手順自体が生む fork 側の変更(dc:generate による fork ドメインの再生成等)も拾う(見逃しより安全側の誤検知)。マーカーファイルのように fork の行が上流の変更のすぐ隣に来る形は ① の接触で拾う。行範囲が離れていても意味の上で依存し合う変更は拾えない。
- **未判定**(この仕組み導入前の旧台帳行): 自台帳の id のうち、`relay:` 欄が無く、`from:` が自分の origin でなく、自分の origin の notice のどの `covers:` にも含まれないもの(継承済み・notice ファイルが無い id は除く)。1 件以上あれば報告に 1 行: 「中継未判定の旧 notice が N 件あります: <id>, ...。`/downreq relay` で中継 notice を下書きできます」。0 件なら何も出さない。

## エッジケース
- `covers:` の id が merge 後のツリー(現役・`done/`)のどこにも無い: その id を報告に含める(黙って飛ばさない)。covers 側 notice の適用自体は続け、その id は台帳に記録しない。
- 祖父 notice の中間 Tier 台帳記録 commit が covers 側 notice の追加 commit より後: covers 側の区間の merge 先をその記録 commit まで伸ばす(区間内で最も後の点を merge 先にする)。
- 自分の origin の notice が `covers:` を持つ(自分が出した中継 notice): 未適用判定の対象外なのは従来どおり。covers 索引には入れず、中継判定の未判定の計算にだけ使う。
- 中継判定で `P` と `Q` の間に上流の変更ファイルが無い(`severity: info` の区切りだけの notice 等): ① は該当なし。②③ に当たらなければ `relay:none`。
- 区間を停止条件で止めた: その区間の notice は台帳に記録されないので中継判定もしない(再開時に判定する)。
