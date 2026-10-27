// dc:init / dc:generate / dc:generate:all / dc:delete の振り分け（index.mjs の本体）

import { createWorkspace } from "../domain/workspace.mjs";
import { getCliArgs, parseOnlyOption } from "./args.mjs";
import { runDelete } from "./delete.mjs";
import { runGenerate } from "./generate.mjs";
import { runGenerateAllInteractive } from "./generateAll.mjs";
import { runInit } from "./init.mjs";
import { confirm, selectDomain } from "./prompts.mjs";

const USAGE =
  "使い方: node scripts/domain-config/index.mjs --init | --generate <Domain> [--yes] [--only <categories>] [--dry-run] | --generate --all [--yes] [--only <categories>] [--dry-run] | --delete <Domain>";

export async function main() {
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
  const dryRun = args.includes("--dry-run");
  // フラグ以外の最初の引数をドメイン名とする（`--generate --yes User` の順でも受け付ける）
  const positionalDomain = args.find((arg) => !arg.startsWith("--"));

  if (!hasInit && !hasGenerate && !hasDelete) {
    console.error(USAGE);
    process.exit(1);
  }
  if ((only || dryRun) && !hasGenerate) {
    console.error(`${only ? "--only" : "--dry-run"} は --generate と併用してください`);
    process.exit(1);
  }

  const workspace = createWorkspace();
  try {
    if (hasInit) {
      const domain = await runInit(workspace);
      if (await confirm("今すぐファイルを生成しますか?", true)) {
        await runGenerate(workspace, domain);
      } else {
        console.log("ファイル生成をスキップしました。");
      }
      return;
    }

    if (hasGenerate) {
      if (hasAll) {
        await runGenerateAllInteractive(workspace, { yes: hasYes, only, dryRun });
        return;
      }
      let domain = positionalDomain;
      if (!domain && hasYes) {
        throw new Error("--yes にはドメイン名が必要です（全ドメインは --all --yes）");
      }
      if (!domain) {
        const domains = workspace.listDomains();
        if (domains.length === 0) {
          console.error("domain.json を含むドメインが存在しません。");
          process.exit(1);
        }
        domain = await selectDomain(domains);
      }
      await runGenerate(workspace, domain, hasYes ? { mode: "config", interactive: false, shouldGenerate: true, only, dryRun } : { only, dryRun });
      return;
    }

    if (hasDelete) {
      if (!positionalDomain) {
        console.error("--delete にはドメイン名が必要です");
        process.exit(1);
      }
      await runDelete(workspace, positionalDomain);
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
