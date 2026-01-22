#!/usr/bin/env node
/**
 * ドメイン設定の初期化とファイル生成を行うスクリプトです。
 *
 * 使用方法:
 *   --init              対話形式で設定ファイルを生成し、続けて生成を行うか確認します。
 *   --generate <Domain> 既に作成した設定ファイルを基にファイル生成のみを行います。
 *   --delete <Domain>   指定したドメインに関連する生成物を削除します。
 *
 * 既存のフォルダが存在する場合もそのまま続行します。
 *
 * 例:
 *   node scripts/domain-config/index.mjs --init
 *   node scripts/domain-config/index.mjs --generate User
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
import inquirer from "inquirer";

const prompt = inquirer.createPromptModule();

async function main() {
  const args = process.argv.slice(2);
  const hasInit = args.includes("--init");
  const generateIndex = args.indexOf("--generate");
  const hasGenerate = generateIndex !== -1;
  const hasAll = args.includes("--all");
  const deleteIndex = args.indexOf("--delete");
  const hasDelete = deleteIndex !== -1;

  if (!hasInit && !hasGenerate && !hasDelete) {
    console.error("使い方: node scripts/domain-config/index.mjs --init | --generate <Domain> | --delete <Domain>");
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
        await generateAll();
        return;
      }
      let domain = args[generateIndex + 1];
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
      await generate(domain);
      return;
    }

    if (hasDelete) {
      const domain = args[deleteIndex + 1];
      if (!domain) {
        console.error("--delete にはドメイン名が必要です");
        process.exit(1);
      }
      await removeDomain(domain);
      return;
    }
  } catch (err) {
    console.error(err.message);
  }
}

main();
