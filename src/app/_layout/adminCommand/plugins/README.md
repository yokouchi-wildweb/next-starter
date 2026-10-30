# plugins(管理者コマンドのプラグインの受け口)

`<名前>.<fork の名前>.tsx` に `export const plugin: AdminCommandPlugin` を置き、`pnpm extensions:generate`。上流の項目は 0。
書き方: `src/features/core/adminCommand/README.md`「プラグインシステム」/ 仕組み: `scripts/extensions/README.md`
