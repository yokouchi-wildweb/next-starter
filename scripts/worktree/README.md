# ワークツリー (worktree)

同じリポジトリを別フォルダにもう 1 つ展開し、別ブランチの作業を並行して進めるための道具です。
`git worktree add` だけでは gitignore 対象 (env / node_modules 等) が入らず DB 操作などが動かないため、それを埋めます。

Claude に任せるときは worktree スキル (`.claude/skills/worktree/`) が同じコマンドを使います。処理の本体はここだけに置きます。

## コマンド

```bash
pnpm worktree:new <branch> [--from <base>] [--path <dir>]
pnpm worktree:sync [path] [--force]
pnpm worktree:remove <path>
```

### worktree:new

1. `git worktree add` を実行
   - 置き場所の既定: 本体の隣の `../<repo名>.wt-<branch>` (`/` などは `-` に置き換え)
   - ブランチがあればそれをチェックアウト、無ければ `--from` (既定: 実行した場所の HEAD) から作る
2. 本体から持ち込み一覧 (`include`) の対象を複製
3. `pnpm install --frozen-lockfile` (pnpm のストアからハードリンクされるので速い)

終わったら `cd <path> && claude` で、新しいターミナルから作業を始めます。

### worktree:sync

本体の env を更新したときなど、既存ワークツリーへ入れ直します。path 省略時は今いるワークツリー。

- 既にあるファイルは上書きしない。内容が違うものは一覧に出すだけ
- `--force` を付けたときだけ上書き (ワークツリー側で書き換えた値は消える)

### worktree:remove

- `git status --short` が空でないと止まる (コミットするか片付けてから)
- gitignore 対象 (env / node_modules) はフォルダごと消える
- ブランチとコミットは残る。不要ならマージ済みを確かめて `git branch -d <branch>`

## 持ち込み一覧 (`include`)

- 書式は `.gitignore` と同じ。パスはリポジトリのルートから
- 複製されるのは「一覧に一致し、かつ gitignore 対象」のファイルだけ。git 管理のファイルは対象外 (ブランチから展開されるため)
- 判定は git 自身 (`git ls-files --exclude-from` と `git check-ignore`) に任せている
- 読むのは常に本体側の一覧。ワークツリーの中から実行しても同じ結果になる
- `node_modules` は入れない (`worktree:new` が `pnpm install` する)
- fork が足すものは `# --- fork entries below ---` より下に書く (merge で衝突しにくくするため)

### Claude Code の `.worktreeinclude` との関係

Claude Code は、自分で作るワークツリー (`claude --worktree` / サブエージェントの worktree 分離 / デスクトップ版の並列セッション) に、リポジトリ直下の `.worktreeinclude` を同じ規則で読んで複製します。

このリポジトリでは直下にファイルを増やさないため、一覧を `scripts/worktree/include` に置き、Claude Code の仕組みには乗せていません。ワークツリーは明示したときだけ `worktree:new` で作る運用のためです。Claude Code 側のワークツリーを常用するようになったら、一覧を直下の `.worktreeinclude` に移し、`lib.ts` の `INCLUDE_FILE` を書き換えます。

Claude Code のワークツリーは `.claude/worktrees/` (リポジトリの内側) にできるため、`eslint.config.mjs` で除外しています (tsc はドットで始まるフォルダを拾わないので不要)。

## 共有されるもの・別々になるもの

- 共有: コミット・ブランチ・stash・git の設定 (片方でコミットすると、もう片方から `git log <branch>` ですぐ見える)
- 別々: 作業中のファイル・ステージング・チェックアウト中のブランチ・gitignore 対象のファイル

## 注意

- **DB は本体と共有**: env を複製するので同じ DB を指す。ワークツリーで `db:push` すると本体の開発 DB も変わる
- **同じブランチは 2 か所で同時にチェックアウトできない** (git が拒否する)
- **dev サーバーを同時に立てるとき**: ポートが衝突する。片方のポートと env の `APP_BASE_URL` を変える (DB 操作・型チェック・テストだけなら関係ない)
- **Claude Code の自動メモリはフォルダごとに別**: ワークツリーで起動したセッションからは本体のメモリが見えない。`CLAUDE.md` と `.claude/rules/` は git 管理なのでどちらでも読まれる
- `servers/room/` は独立した package なので、使うならワークツリー側で別途 install する

## テスト

```bash
pnpm test:worktree
```

一時ディレクトリに作った git リポジトリで、持ち込み対象の判定・複製 (上書きしない / `--force`)・ワークツリーからの本体特定を確かめます。
