#!/usr/bin/env node
/**
 * ドメイン設定（手で書いた domain.json）からファイルを生成・削除する CLI の入口（本体は cli/main.mjs）。
 *
 * 使用方法:
 *   --generate <Domain> 設定ファイルを基にファイルを生成します（既定は対話なし。domain.json の generate どおり、false は何も書かない）。
 *   --generate --all    domain.json を持つ全ドメインを一括で生成します（既定は対話なし）。
 *   --delete <Domain>   指定したドメインに関連する生成物を削除します。
 *   -i, --interactive   --generate と併用。生成方法・カテゴリ・ドメインを対話で選び、上書きを確認します（選択は保存しない）。
 *   --only <categories> --generate と併用。今回はこのカテゴリだけ生成します（generate: false のドメインでも書く。例: --only registry）。
 *   --dry-run           --generate と併用。何も書かず、書くはずのファイルと動作（作成 / 上書き / 変更なし / 保持）を一覧します。
 *   --yes               受け付けて無視します（以前は対話なしにする旗。今は既定が対話なし）。
 *   書き込みの最後に src/features/feature-map.txt（ドメインの一覧）を書き直します。
 *
 * 単独の `--` は無視します（`pnpm dc:generate -- User` を許容するため）。
 * 失敗時は終了コード 1 で終了します。何も書く前に検査で止まり、書きかけのファイルは残しません。
 *
 * 例:
 *   node scripts/structure/domain/index.mjs --generate User
 *   node scripts/structure/domain/index.mjs --generate User -i
 *   node scripts/structure/domain/index.mjs --generate --all --only registry
 *   node scripts/structure/domain/index.mjs --generate --all --dry-run
 *   node scripts/structure/domain/index.mjs --delete User
 */
import { main } from "./cli/main.mjs";

main();
