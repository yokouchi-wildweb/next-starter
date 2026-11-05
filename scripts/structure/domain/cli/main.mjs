// dc:generate / dc:generate:all / dc:delete の振り分け（index.mjs の本体）。domain.json は手で書く（対話で組み立てる入口は無い）

import { createWorkspace } from "../domain/workspace.mjs";
import { getCliArgs, parseOnlyOption, takeValueOption } from "./args.mjs";
import { runDelete } from "./delete.mjs";
import { runGenerate } from "./generate.mjs";
import { runGenerateAllInteractive } from "./generateAll.mjs";
import { selectDomain } from "./prompts.mjs";

const USAGE =
  "使い方: node scripts/structure/domain/index.mjs --generate <Domain> [--only <categories>] [--dry-run] [-i] | --generate --all [--only <categories>] [--dry-run] [-i] | --delete <Domain> --confirm <snake_name> [--extra <path>]... [--remove-config] [-i]";

export async function main() {
  let args;
  let only;
  let confirmValues;
  let extraValues;
  try {
    // 値を取るオプション（--only・--confirm・--extra）の値をドメイン名と取り違えないよう、先に取り除く
    ({ only, rest: args } = parseOnlyOption(getCliArgs()));
    ({ values: confirmValues, rest: args } = takeValueOption(args, "confirm"));
    ({ values: extraValues, rest: args } = takeValueOption(args, "extra"));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const hasGenerate = args.includes("--generate");
  const hasAll = args.includes("--all");
  const hasDelete = args.includes("--delete");
  // --generate の既定は対話なし（domain.json の generate どおり）。-i / --interactive のときだけ対話。--yes は受け付けて無視（以前の既定を変える旗）
  const interactive = args.includes("-i") || args.includes("--interactive");
  const dryRun = args.includes("--dry-run");
  // フラグ以外の最初の引数をドメイン名とする（`--generate --yes User` の順でも受け付ける）
  const positionalDomain = args.find((arg) => !arg.startsWith("-"));

  if (!hasGenerate && !hasDelete) {
    console.error(USAGE);
    process.exit(1);
  }
  if ((only || dryRun) && !hasGenerate) {
    console.error(`${only ? "--only" : "--dry-run"} は --generate と併用してください`);
    process.exit(1);
  }

  const workspace = createWorkspace();
  try {
    if (hasGenerate) {
      if (hasAll) {
        await runGenerateAllInteractive(workspace, { yes: !interactive, only, dryRun });
        return;
      }
      let domain = positionalDomain;
      if (!domain && !interactive) {
        throw new Error("ドメイン名を指定してください（全ドメインは --all、選んで生成するなら -i）");
      }
      if (!domain) {
        const domains = workspace.listDomains();
        if (domains.length === 0) {
          console.error("domain.json を含むドメインが存在しません。");
          process.exit(1);
        }
        domain = await selectDomain(domains);
      }
      await runGenerate(workspace, domain, interactive ? { only, dryRun } : { mode: "config", interactive: false, shouldGenerate: true, only, dryRun });
      return;
    }

    if (hasDelete) {
      if (!positionalDomain) {
        console.error("--delete にはドメイン名が必要です");
        process.exit(1);
      }
      await runDelete(workspace, positionalDomain, {
        interactive,
        confirm: confirmValues.at(-1),
        extras: extraValues,
        removeConfig: args.includes("--remove-config"),
      });
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
