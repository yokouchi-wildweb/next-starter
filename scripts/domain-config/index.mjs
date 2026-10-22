#!/usr/bin/env node
/**
 * ドメイン設定の初期化とファイル生成を行うスクリプトです。
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
 * 失敗時は終了コード 1 で終了します。
 * 既存のフォルダが存在する場合もそのまま続行します。
 *
 * 例:
 *   node scripts/domain-config/index.mjs --init
 *   node scripts/domain-config/index.mjs --generate User
 *   node scripts/domain-config/index.mjs --generate User --yes
 *   node scripts/domain-config/index.mjs --generate --all --yes --only registry
 *   node scripts/domain-config/index.mjs --delete User
 *
 * さらに、package.json の "bin" フィールドに設定することで
 *   npx domain-config --init
 *   npx domain-config --generate User
 *   npx domain-config --delete User
 * のように短いコマンドで呼び出すこともできます。
 */
import init from "./init.mjs";
import generate from "./generate.mjs";
import generateAll, { findDomainDirectories } from "./generate-all.mjs";
import removeDomain from "./delete.mjs";
import { getCliArgs } from "./utils/cliArgs.mjs";
import { parseOnlyOption } from "./utils/onlyOption.mjs";
import inquirer from "inquirer";

const prompt = inquirer.createPromptModule();

async function main() {
  let args;
  let only;
  try {
    // `--only` の値（例: registry）をドメイン名と取り違えないよう、先に取り除く
    ({ only, rest: args } = parseOnlyOption(getCliArgs()));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const hasInit = args.includes("--init");
  const hasGenerate = args.includes("--generate");
  const hasAll = args.includes("--all");
  const hasDelete = args.includes("--delete");
  const hasYes = args.includes("--yes");
  // フラグ以外の最初の引数をドメイン名とする（`--generate --yes User` の順でも受け付ける）
  const positionalDomain = args.find((arg) => !arg.startsWith("--"));

  if (!hasInit && !hasGenerate && !hasDelete) {
    console.error("使い方: node scripts/domain-config/index.mjs --init | --generate <Domain> [--yes] [--only <categories>] | --generate --all [--yes] [--only <categories>] | --delete <Domain>");
    process.exit(1);
  }
  if (only && !hasGenerate) {
    console.error("--only は --generate と併用してください");
    process.exit(1);
  }

  try {
    if (hasInit) {
      const domain = await init();
      const { doGenerate } = await prompt({
        type: 'confirm',
        name: 'doGenerate',
        message: '今すぐファイルを生成しますか?',
        default: true,
      });
      if (doGenerate) {
        await generate(domain);
      } else {
        console.log('ファイル生成をスキップしました。');
      }
      return;
    }

    if (hasGenerate) {
      if (hasAll) {
        await generateAll({ yes: hasYes, only });
        return;
      }
      let domain = positionalDomain;
      if (!domain && hasYes) {
        throw new Error("--yes にはドメイン名が必要です（全ドメインは --all --yes）");
      }
      if (!domain) {
        const domains = findDomainDirectories();
        if (domains.length === 0) {
          console.error("domain.json を含むドメインが存在しません。");
          process.exit(1);
        }
        const { selectedDomain } = await prompt({
          type: "list",
          name: "selectedDomain",
          message: "生成するドメインを選択してください:",
          choices: domains.map((d) => ({ name: d, value: d })),
          loop: false,
        });
        domain = selectedDomain;
      }
      await generate(domain, hasYes ? { mode: "config", interactive: false, shouldGenerate: true, only } : { only });
      return;
    }

    if (hasDelete) {
      const domain = positionalDomain;
      if (!domain) {
        console.error("--delete にはドメイン名が必要です");
        process.exit(1);
      }
      await removeDomain(domain);
      return;
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

main();
