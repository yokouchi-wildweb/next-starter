# Git ブランチ整理マニュアル（PowerShell対応）

## 🧹 ローカルのマージ済みブランチを削除（main にマージ済み）

```bash
# ✅ 最新の origin/main を取得してから作業開始
git fetch --prune
git checkout main
git pull origin main

# ✅ main にマージ済みのローカルブランチをローカル・リモート両方から削除
git branch --merged origin/main | grep -v '\*' | grep -v 'main' | while read branch; do
  echo "🗑 ローカル削除: $branch"
  git branch -d "$branch" 2>/dev/null || echo "⚠ ローカル削除失敗: $branch"

  echo "🗑 リモート削除: $branch"
  git push origin --delete "$branch" 2>/dev/null || echo "⚠ リモート削除失敗（存在しない可能性）: $branch"
done
```

## マージ済み関係なくmain以外すべて削除

```bash
# 1. ローカルで main に切り替え
git checkout main

# 2. 最新化 & 不要な参照の削除
git fetch --prune

# 3. ローカルの main 以外を削除
git branch | grep -v "^* main$" | while read -r branch; do
  git branch -D "$branch"
done

# 4. リモートを最新化（--prune 付き）
git fetch origin --prune

# 5. リモートの main 以外のブランチ一覧を取得して削除
for branch in $(git ls-remote --heads origin | awk '{print $2}' | sed 's#refs/heads/##' | grep -v '^main$'); do
  echo "🔸 Deleting remote branch: $branch"
  git push origin --delete "$branch"
done
```
