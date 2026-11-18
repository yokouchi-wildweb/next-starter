# 視覚的並列実行スクリプト（tmux版）

## Overview

- tmux で、複数の Claude Code エージェントを別々のペインで視覚的に並列実行するスクリプト集
- 要件: tmux(無ければエラー)・claude CLI(Claude Code がインストール済み)・tmux が動くターミナル

| 環境 | 対応 | 備考 |
|-----|------|------|
| macOS | ✅ | `brew install tmux` |
| Linux | ✅ | `apt install tmux` |
| WSL | ✅ | `apt install tmux` |
| Windows (ネイティブ) | ❌ | tmux非対応 |

## Usage

### expert-panel-tmux.sh

4 人の専門家が並列で分析（4 分割ペイン）

```bash
.claude/scripts/visual/expert-panel-tmux.sh "分析対象のテーマ"
```

**例:**
```bash
.claude/scripts/visual/expert-panel-tmux.sh "新しい認証フローの実装方針"
```

**レイアウト:**
```
┌─────────────────┬─────────────────┐
│ 🔐 セキュリティ  │ 🔧 保守性        │
├─────────────────┼─────────────────┤
│ ⚡ パフォーマンス │ 🏗️ アーキテクチャ │
└─────────────────┴─────────────────┘
```

### second-opinion-tmux.sh

複数の回答者が独立して検討（2〜5 分割ペイン）

```bash
.claude/scripts/visual/second-opinion-tmux.sh <回数:2-5> "検討テーマ"
```

**例:**
```bash
.claude/scripts/visual/second-opinion-tmux.sh 3 "状態管理をReduxかZustandか"
```

**レイアウト（3名の場合）:**
```
┌─────────────────┬─────────────────┐
│ 👤 回答者 A     │                 │
├─────────────────┤ 👤 回答者 C     │
│ 👤 回答者 B     │                 │
└─────────────────┴─────────────────┘
```

### brainstorm-tmux.sh

5 チームが並列でアイデア出し（5 分割ペイン）

```bash
.claude/scripts/visual/brainstorm-tmux.sh <アイデア数:10-30> "テーマ"
```

**例:**
```bash
.claude/scripts/visual/brainstorm-tmux.sh 20 "ユーザー体験改善のアイデア"
```

**レイアウト:**
```
┌─────────────────┬─────────────────┐
│ 🔧 改善・最適化  │ 👤 UX・体験     │
├─────────────────┼─────────────────┤
│ 🚀 革新・新規    │ ⚙️ 技術チャレンジ │
├─────────────────┤                 │
│ ✨ シンプル     │                 │
└─────────────────┴─────────────────┘
```

### tmux の操作

| 操作 | キー |
|-----|------|
| ペイン間移動 | `Ctrl+B` → 矢印キー |
| ペインを最大化/復元 | `Ctrl+B` → `z` |
| セッション終了 | `Ctrl+B` → `:kill-session` |
| デタッチ（バックグラウンド化） | `Ctrl+B` → `d` |
| 再アタッチ | `tmux attach -t セッション名` |

- 普段から tmux を使っている人は `Ctrl+B` を 2 回押す必要がある場合がある(prefix key の競合)

### トラブルシューティング

#### tmux がインストールされていない

```bash
# macOS
brew install tmux

# Ubuntu/Debian/WSL
sudo apt update && sudo apt install tmux

# CentOS/RHEL
sudo yum install tmux
```

#### セッションが残っている

```bash
# 全セッション確認
tmux list-sessions

# 特定セッション削除
tmux kill-session -t セッション名

# 全セッション削除
tmux kill-server
```

#### ペインが小さすぎる

- ターミナルウィンドウを大きくするか、`Ctrl+B` → `z` で個別ペインを最大化する
