#!/usr/bin/env node
/**
 * ドメイン設定の初期化とファイル生成を行う CLI の入口（本体は cli/main.mjs）。
 *
 * 使用方法:
 *   --init              対話形式で設定ファイルを生成し、続けて生成を行うか確認します。
 *   --generate <Domain> 既に作成した設定ファイルを基にファイル生成のみを行います。
 *   --generate --all    domain.json を持つ複数ドメインを一括で生成します。
 *   --delete <Domain>   指定したドメインに関連する生成物を削除します。
 *   --yes               --generate と併用。プロンプトを出さず domain.json の generateFiles どおりに生成します。
 *   --only <categories> --generate と併用。generateFiles で true のカテゴリをさらに絞り込みます（例: --only registry）。
 *
 * 単独の `--` は無視します（`pnpm dc:generate -- User` を許容するため）。
 * 失敗時は終了コード 1 で終了します。何も書く前に検査で止まり、書きかけのファイルは残しません。
 *
 * 例:
 *   node scripts/domain-config/index.mjs --init
 *   node scripts/domain-config/index.mjs --generate User
 *   node scripts/domain-config/index.mjs --generate User --yes
 *   node scripts/domain-config/index.mjs --generate --all --yes --only registry
 *   node scripts/domain-config/index.mjs --delete User
 */
import { main } from "./cli/main.mjs";

main();
