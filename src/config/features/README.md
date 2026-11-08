# src/config/features — ドメインの上書き

ドメイン(`src/features/<名前>`・`src/features/core/<名前>`)1 つに上書き 1 本: `<名前>.config.ts`。名前はドメインのフォルダ名(core も業務も同じ平らなフォルダ)。持ち主のドメインが描画用の `config.ui.ts` を持つときだけ `<名前>.ui.config.ts` を並べます。

- 持ち主の既定と型は `<ドメイン>/config.ts`。上書きはそこだけが読む
- 閉じられる機能を開ける・閉じる値(`enabled`)もここに書く(処理の切り替えの値とは別)
- 置き方・中身の決まり・1 対 1 の検査: [../README.md](../README.md)
