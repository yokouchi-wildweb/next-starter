#!/usr/bin/env node
// .notices/20261123-040814-district-stage3.forks.mjs
// 段 3(地区の議会、注文 23〜38)で fork が要る手当てを 1 回で当てる道具。fork のリポのルートで、上流の段 3 の区間を取り込んだ後に走らせる。
// (区切り district-stage3 の notice 20261123-040814-district-stage3 の道具)
// 使い方: node .notices/20261123-040814-district-stage3.forks.mjs [--apply] [--json] [--owner <元のパス>=<行き先のドメイン か lib のフォルダ> …]
//   既定は dry-run(表を出すだけ、何も書かない)。--apply で書く。止めた物があれば終了コード 1。2 回目は何もしない
//
// 順に当てる:
//  1. plugs: ドメインの受け口のフォルダの項目・messages・recordTargets を <ドメイン>/plugs/ へ(./20261123-040814-district-stage3.plugs.mjs をそのまま使う)
//  2. 古い置き場に残った fork の項目を、fork 自身のドメインか lib の plugs/<点>/ へ(D38・D41。上流の物は取り込みで動いた後なので、残っている物は fork の物):
//     src/wiring/formInputs/inputs → formInputs / src/wiring/dbAgent/{extraTools,promptFragments,suffixProviders} → dbAgentTools・dbAgentPromptFragments・
//     dbAgentSuffixProviders / src/wiring/serverErrors/reporters → serverErrorReporters(register を持つ物は止める: 起動時の処理は plugs/startupTasks へ手で分ける、注文 33)/
//     src/proxies/<名前>.ts の handler・decorator → proxyHandlers(段 export const stage = "main" を足す。止める・型の段は手で)・proxyDecorators /
//     src/proxies/redirects/<名前>.ts → proxyRedirects / src/app/_layout/adminCommand/{categories,plugins}/<名前> → adminCommandCategories・adminCommandPlugins /
//     src/app/_providers/ForkProviders.replace.tsx → rootProviders/<行き先の名前>.tsx(段 project、export const provider を足す、注文 32)
//     行き先: --owner、無ければ項目の名前で始まる fork のドメイン(一番長い名前)。決まらなければ候補つきで止める(上流の core と lib には足さない。
//     候補は項目が読む fork のドメインを先に並べる。読むだけでは行き先にしない、D38)
//     上流のドメインの古い受け口のフォルダ(OLD_RECEPTACLES・messages・recordTargets)に残った fork の項目も同じに。上書き・差替は対象の上流の項目の隣へ。
//     adminBulkActions(項目のドメインの一覧に効く)は動かさず手の作業に。上流が消した ForkProviders の 1 行スイッチは消す
//  2b. 上流の plugs/<点>/ に入った fork の項目: 上流が受け口のフォルダを plugs/ へ動かした取り込みで、git のフォルダの付け替えの推測が fork の項目も
//     一緒に上流のドメイン・lib の plugs/<点>/ へ運ぶ(merge の CONFLICT (file location)、その場所のまま git add する)。親の版に無い項目を
//     2 と同じ決め方で fork 自身のドメインの plugs/<点>/ へ(上流の項目の横の <名前>.override・<名前>.replace は残す)。親の版が読めなければ手の作業に出す
//  3. 常設の宣言: どの規則にも載らない fork のドメインの extensionPoints.ts に export const alwaysOpen = true(無ければ作る、注文 35)
//  4. 型だけの入口: 項目の約束の型の import を <持ち主>/points へ(./20261123-040814-district-stage3.points-entries.mjs をそのまま使う、注文 37)
//  5. lint の名前: import-boundaries/lib-no-domains → import-boundaries/district-no-domains(eslint-disable の行・eslint.config.fork.mjs、注文 38)
//  手の作業の一覧(書かない): 消した例外の受け口の項目(src/featureGate/alwaysOnExceptions・dependencyExceptions、scripts/proxies/alwaysOnExceptions、注文 36)・
//  上流の枠(_layout)に fork が足した部品のうちドメインを読む物(候補の点 userHeaderActions・userOverlays・adminOverlays・rootProviders、注文 32・38)・
//  古い置き場に残った項目でない物
//
// fork の手順: 上流の段 3 の区間を取り込む → dry-run → 止めた物を --owner で決める → --apply → 手の作業 → pnpm generate extensions・registry・district-map

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import { forkAddedFiles } from "../src/lib/forkOwnership/node.mjs";
import { PLUGS_REGISTRY_FOLDERS } from "../src/lib/districtMap/index.mjs";
import { readDistrictMapAt } from "../src/lib/districtMap/node.mjs";
import { applyPlugs, domainByName, domainsImported, planPlugs, rewriteRelativeImports } from "./20261123-040814-district-stage3.plugs.mjs";
import { applyPointsEntries, plan as planPointsEntries } from "./20261123-040814-district-stage3.points-entries.mjs";

const SOURCE = /\.(tsx?|mts)$/;
const TEST = /\.(test|spec)\.[cm]?tsx?$/;

/** 古い置き場(フォルダ)→ 点。項目 = 直下の <名前>.ts(x) か <名前>/(フォルダの項目) */
export const OLD_PLACES = [
  { from: "src/wiring/formInputs/inputs", point: "formInputs" },
  { from: "src/wiring/dbAgent/extraTools", point: "dbAgentTools" },
  { from: "src/wiring/dbAgent/promptFragments", point: "dbAgentPromptFragments" },
  { from: "src/wiring/dbAgent/suffixProviders", point: "dbAgentSuffixProviders" },
  { from: "src/wiring/serverErrors/reporters", point: "serverErrorReporters", stopIf: /\bregister\s*[:(]/, stopText: "register を持つ(起動時の処理は自分の plugs/startupTasks/<名前>.ts の export const task へ手で分ける、注文 33)" },
  { from: "src/proxies/redirects", point: "proxyRedirects" },
  { from: "src/app/_layout/adminCommand/categories", point: "adminCommandCategories" },
  { from: "src/app/_layout/adminCommand/plugins", point: "adminCommandPlugins" },
];
/** 上流の proxies の骨組み(項目ではない) */
const PROXIES_SKELETON = new Set(["index.ts", "types.ts", "points.ts", "redirect.ts", "extensionPoints.ts", "proxyFrame.ts", "README.md"]);
const FORK_PROVIDERS = "src/app/_providers/ForkProviders.replace.tsx";
/** 上流が注文 32 で消した 1 行スイッチ(fork が .replace へ向けて変えていると取り込みで modify/delete になり残る) */
const FORK_PROVIDERS_SWITCH = "src/app/_providers/ForkProviders.tsx";
const SWITCH_ONLY = /^(?:\s*\/\/[^\n]*\n|\s*\n)*\s*export\s*\{[^}]*\}\s*from\s*["']\.\/ForkProviders\.(?:replace|default)["'];?\s*$/;
/** 消した例外の受け口(注文 36)。中身は手で直す */
const OLD_EXCEPTION_PLACES = ["src/featureGate/alwaysOnExceptions", "src/featureGate/dependencyExceptions", "scripts/proxies/alwaysOnExceptions"];
const LINT_OLD = "import-boundaries/lib-no-domains";
const LINT_NEW = "import-boundaries/district-no-domains";
/** 上流の plugs/<点> のフォルダ(ドメインか lib の。項目のフォルダの中まで含むパスから) */
const UPSTREAM_PLUGS_DIR = /^(src\/(?:domains|lib)\/.+?\/plugs\/[^/]+)\/([^/]+)/;
/** 上流の項目の横に置く変更の型(override・replace)。動かさない */
const CHANGE_MARK = /\.(override|replace)\.tsx?$/;
/**
 * 上流のドメインが段 3(注文 24・28)で plugs/<点>/ へ動かした受け口の古いフォルダ → 点。取り込みで git が運ばなかった fork の項目がここに残る
 * (2b の運ばれた物と同じに扱う)。表は 5a796e038(段 2 の区切り)の宣言の dir と今の点の名前から作った。登録表のフォルダ(messages・recordTargets)は親の版から求める
 */
export const OLD_RECEPTACLES = [
  { from: "src/domains/core/admin/dashboard/sections", point: "adminDashboardSections" },
  { from: "src/domains/core/admin/menu/categories", point: "adminMenuCategories" },
  { from: "src/domains/core/admin/menu/items", point: "adminMenuItems" },
  { from: "src/domains/core/adminCommand/navigationItems", point: "adminCommandNavigationItems" },
  { from: "src/domains/core/analytics/exclusionProviders", point: "analyticsExclusionProviders" },
  { from: "src/domains/core/analytics/rollupMetrics", point: "analyticsRollupMetrics" },
  { from: "src/domains/core/analytics/services/server/coinIssuance/sources", point: "analyticsCoinIssuanceSources" },
  { from: "src/domains/core/bankTransferReview/adminBulkActions", point: "adminBulkActions" },
  { from: "src/domains/core/batchJob/jobHandlers", point: "batchJobJobHandlers" },
  { from: "src/domains/core/coupon/adminSectionTabs", point: "couponSectionTabs" },
  { from: "src/domains/core/interactionTracking/targetRules", point: "interactionTrackingTargetRules" },
  { from: "src/domains/core/messaging/adminBulkActions", point: "adminBulkActions" },
  { from: "src/domains/core/messaging/categories", point: "messagingCategories" },
  { from: "src/domains/core/messaging/categoryGroups", point: "messagingCategoryGroups" },
  { from: "src/domains/core/messaging/channels", point: "messagingChannels" },
  { from: "src/domains/core/messaging/enrichers", point: "messagingEnrichers" },
  { from: "src/domains/core/messaging/layouts", point: "messagingLayouts" },
  { from: "src/domains/core/messaging/sources", point: "messagingSources" },
  { from: "src/domains/core/messaging/subscribers", point: "messagingSubscribers" },
  { from: "src/domains/core/milestone/components/renderers", point: "milestoneRenderers" },
  { from: "src/domains/core/milestone/services/server/definitions", point: "milestoneDefinitions" },
  { from: "src/domains/core/pairedDevice/kinds", point: "pairedDeviceKinds" },
  { from: "src/domains/core/purchaseRequest/services/server/completion/strategies", point: "purchaseRequestCompletionStrategies" },
  { from: "src/domains/core/purchaseRequest/services/server/hooks/definitions", point: "purchaseRequestCompleteHooks" },
  { from: "src/domains/core/referralReward/rewardGroups", point: "referralRewardRewardGroups" },
  { from: "src/domains/core/referralReward/services/server/handlers", point: "referralRewardRewardHandlers" },
  { from: "src/domains/core/setting/fields", point: "settingFields" },
  { from: "src/domains/core/setting/sections", point: "settingSections" },
  { from: "src/domains/core/storageObject/purposes", point: "storageObjectPurposes" },
  { from: "src/domains/core/user/adminBulkActions", point: "adminBulkActions" },
  { from: "src/domains/core/user/adminManageTabs", point: "userAdminManageTabs" },
  { from: "src/domains/core/user/cleanupHandlers", point: "userCleanupHandlers" },
  { from: "src/domains/core/user/mypageMenu/items", point: "userMypageMenu" },
  { from: "src/domains/core/user/reservedNames", point: "userReservedNames" },
  { from: "src/domains/core/userAcquisition/channels", point: "userAcquisitionChannels" },
  { from: "src/domains/core/userGroup/criteria", point: "userGroupCriteria" },
  { from: "src/domains/core/userLineProfile/webhookHandlers", point: "userLineProfileWebhookHandlers" },
  { from: "src/domains/core/wallet/purchaseBonuses", point: "walletPurchaseBonuses" },
  { from: "src/domains/core/walletHistory/reasonKeys", point: "walletHistoryReasonKeys" },
];
/** 項目のドメインの一覧に効く点(項目を fork のドメインへ動かすと効く一覧が変わる) */
const LIST_BOUND_POINT = "adminBulkActions";
const REGISTRY_IN_PLUGS = new RegExp(`^(src/domains/.+?)/plugs/(${PLUGS_REGISTRY_FOLDERS.join("|")})/`);

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const isDir = (abs) => existsSync(abs) && statSync(abs).isDirectory();
const nameOf = (entry) => entry.replace(/\.(tsx?|mts)$/, "");

function* walk(abs, rel) {
  if (!existsSync(abs)) return;
  for (const name of readdirSync(abs).sort(byName)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const a = join(abs, name);
    const r = `${rel}/${name}`;
    if (statSync(a).isDirectory()) yield* walk(a, r);
    else yield r;
  }
}

/** fork のドメイン(core でない)の名前 → フォルダ、どの規則にも載らず常設の宣言も無い物 */
function forkDomainsOf(root) {
  const districts = readDistrictMapAt(root).districts.filter((d) => d.kind === "domains" && !d.core);
  return {
    byName: new Map(districts.map((d) => [d.name, d.dir])),
    unlisted: districts.filter((d) => d.gates.length === 0 && !d.alwaysOpen).map((d) => d.dir),
  };
}

/**
 * 行き先のフォルダ(ドメインか lib の dir)
 * @returns {{ dir: string, rule: "owner" | "name" } | { stop: string, candidates: string[] }}
 */
function ownerFor(path, item, owners, domains, texts = []) {
  if (owners[path]) return { dir: owners[path].replace(/\/$/, ""), rule: "owner" };
  const named = domainByName(item, [...domains.byName.keys()]);
  if (named) return { dir: domains.byName.get(named), rule: "name" };
  // 候補: 項目が読む fork のドメインを先に(決めはしない: 読むだけのドメインは行き先と限らない、D38)
  const reads = [...new Set(texts.flatMap((t) => [...domainsImported(t)]))].filter((d) => domains.byName.has(d)).sort(byName).map((d) => domains.byName.get(d));
  const rest = [...domains.byName.values()].filter((dir) => !reads.includes(dir));
  return { stop: "行き先のドメインが名前で決まらない(fork 自身のドメインか lib を --owner で選ぶ。上流の core には足さない、D41)", candidates: [...reads, ...rest].slice(0, 8), reads };
}

/** 項目(ファイルかフォルダ)のソースの中身 */
function textsOf(root, path) {
  const abs = join(root, path);
  return isDir(abs) ? [...walk(abs, path)].filter((f) => SOURCE.test(f)).map((f) => readFileSync(join(root, f), "utf8")) : [readFileSync(abs, "utf8")];
}

/** 親の版の src/domains・src/lib のファイル(読めなければ null) */
function parentFilesOf(root, parentRef) {
  try {
    return execFileSync("git", ["ls-tree", "-r", "--name-only", parentRef, "--", "src/domains", "src/lib"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * 計画
 * @param {string} root
 * @param {{ owners?: Record<string, string> }} [options]
 */
export function planForks(root, { owners = {} } = {}) {
  const domains = forkDomainsOf(root);
  const moves = [];
  const stops = [];
  const hand = [];
  const added = forkAddedFiles(root, { fetch: false });
  const parentFiles = added.status === "ok" ? parentFilesOf(root, added.parentRef) : null;
  if (added.status === "ok" && parentFiles === null) hand.push({ path: "-", text: `親の版 ${added.parentRef} のファイルを読めない: 上流の plugs/<点>/ に入った fork の項目は手で自分のドメインへ` });
  /** 上流の plugs/<点> → 親の版の項目の名前 */
  const upstreamItems = new Map();
  for (const f of parentFiles ?? []) {
    const m = UPSTREAM_PLUGS_DIR.exec(f);
    if (m) upstreamItems.set(m[1], (upstreamItems.get(m[1]) ?? new Set()).add(m[2]));
  }
  const parentSet = new Set(parentFiles ?? []);
  /**
   * 1 つの置き場の項目を決める
   * @param {{ from: string, point: string, stopIf?: RegExp, stopText?: string }} place
   * @param {string} label 止める・手の作業の文の頭
   * @param {Set<string>} keep 残す名前(上流の項目)
   */
  const placeItems = (place, label, keep = new Set()) => {
    const abs = join(root, place.from);
    if (!isDir(abs)) return;
    for (const entry of readdirSync(abs).sort(byName)) {
      const path = `${place.from}/${entry}`;
      if (entry === "README.md" || keep.has(entry) || parentSet.has(path)) continue;
      const folder = isDir(join(abs, entry));
      if (!folder && CHANGE_MARK.test(entry)) {
        // 上書き・差替: 対象の上流の項目の隣へ(git の付け替えが古い持ち主の側に置いた物、注文 40)
        const target = entry.replace(CHANGE_MARK, "");
        if ([...keep].some((n) => n === target || nameOf(n) === target)) continue;
        const dirs = [...upstreamItems].filter(([dir, names]) => dir.endsWith(`/plugs/${place.point}`) && [...names].some((n) => n === target || nameOf(n) === target)).map(([dir]) => dir);
        if (dirs.length === 1) moves.push({ from: path, to: `${dirs[0]}/${entry}`, point: place.point, rule: "target" });
        else hand.push({ path, text: `${label}上書き・差替の対象 ${target} が点 ${place.point} の上流の項目に${dirs.length === 0 ? "無い(消えた項目への上書きは消す)" : `複数ある(${dirs.join("・")})`}` });
        continue;
      }
      if (!folder && (!SOURCE.test(entry) || TEST.test(entry))) {
        hand.push({ path, text: `${label}項目でない物(項目のテストは項目と一緒に手で動かす・README・生成物は消す)` });
        continue;
      }
      if (place.point === LIST_BOUND_POINT) {
        hand.push({ path, text: `${label}点 ${LIST_BOUND_POINT} は項目のドメインの一覧に効く: 上流の一覧への一括操作は fork のドメインへ動かせない(上流へ /order、待つ間は一時許可、D38)` });
        continue;
      }
      const texts = textsOf(root, path);
      if (place.stopIf && texts.some((t) => place.stopIf.test(t))) {
        stops.push({ path, text: place.stopText, candidates: [] });
        continue;
      }
      const owner = ownerFor(path, folder ? entry : nameOf(entry), owners, domains, texts);
      if ("stop" in owner) stops.push({ path, text: `${label}${owner.stop}`, candidates: owner.candidates, reads: owner.reads });
      else moves.push({ from: path, to: `${owner.dir}/plugs/${place.point}/${entry}`, point: place.point, rule: owner.rule });
    }
  };
  // 2. 古い置き場(結線・proxies の redirects・管理者コマンド)と上流のドメインの古い受け口のフォルダ
  for (const place of OLD_PLACES) placeItems(place, "");
  for (const place of OLD_RECEPTACLES) placeItems(place, `上流の古い受け口 ${place.from} に残った fork の項目: `);
  const registryOld = new Set();
  for (const f of parentFiles ?? []) {
    const m = REGISTRY_IN_PLUGS.exec(f);
    if (m) registryOld.add(`${m[1]}/${m[2]}`);
  }
  for (const from of [...registryOld].sort(byName)) placeItems({ from, point: from.slice(from.lastIndexOf("/") + 1) }, `上流の古い登録表のフォルダ ${from} に残った fork の項目: `);
  // 2b. 上流の plugs/<点>/ に git が運んだ fork の項目
  for (const [dir, names] of [...upstreamItems].sort(([a], [b]) => byName(a, b))) placeItems({ from: dir, point: dir.slice(dir.lastIndexOf("/") + 1) }, `上流の plugs/${dir.slice(dir.lastIndexOf("/") + 1)}/ に入った fork の項目: `, names);
  // proxies の直下の項目(handler / decorator)
  if (isDir(join(root, "src/proxies"))) {
    for (const entry of readdirSync(join(root, "src/proxies")).sort(byName)) {
      if (PROXIES_SKELETON.has(entry) || !SOURCE.test(entry) || TEST.test(entry)) continue;
      const path = `src/proxies/${entry}`;
      const text = readFileSync(join(root, path), "utf8");
      const kind = /^export\s+const\s+handler\b/m.test(text) ? "proxyHandlers" : /^export\s+const\s+decorator\b/m.test(text) ? "proxyDecorators" : null;
      if (!kind) continue;
      const owner = ownerFor(path, nameOf(entry), owners, domains, [text]);
      if ("stop" in owner) stops.push({ path, text: owner.stop, candidates: owner.candidates, reads: owner.reads });
      else moves.push({ from: path, to: `${owner.dir}/plugs/${kind}/${entry}`, point: kind, rule: owner.rule, stage: kind === "proxyHandlers" && !/^export\s+const\s+stage\b/m.test(text) ? "main" : null });
    }
  }
  // ForkProviders
  if (existsSync(join(root, FORK_PROVIDERS))) {
    const text = readFileSync(join(root, FORK_PROVIDERS), "utf8");
    if (!/export\s+function\s+ForkProviders\b/.test(text)) stops.push({ path: FORK_PROVIDERS, text: "export function ForkProviders が読めない(rootProviders の項目 export const provider と段 project を手で書く、注文 32)", candidates: [] });
    else {
      const owner = ownerFor(FORK_PROVIDERS, "", owners, domains, [text]);
      if ("stop" in owner) stops.push({ path: FORK_PROVIDERS, text: `fork の Provider の行き先: ${owner.stop}`, candidates: owner.candidates, reads: owner.reads });
      else moves.push({ from: FORK_PROVIDERS, to: `${owner.dir}/plugs/rootProviders/${owner.dir.slice(owner.dir.lastIndexOf("/") + 1)}Providers.tsx`, point: "rootProviders", rule: owner.rule, forkProviders: true });
    }
  }
  // 上流が消した 1 行スイッチ: スイッチだけなら消す、ほかの中身があれば手で
  const removes = [];
  if (existsSync(join(root, FORK_PROVIDERS_SWITCH))) {
    if (SWITCH_ONLY.test(readFileSync(join(root, FORK_PROVIDERS_SWITCH), "utf8"))) removes.push(FORK_PROVIDERS_SWITCH);
    else hand.push({ path: FORK_PROVIDERS_SWITCH, text: "上流が消した ForkProviders の 1 行スイッチにスイッチでない中身がある(中身を rootProviders の項目へ移してから消す、注文 32)" });
  }
  // 手の作業: 消した例外の受け口
  for (const place of OLD_EXCEPTION_PLACES) for (const f of walk(join(root, place), place)) if (!f.endsWith("README.md")) hand.push({ path: f, text: "消した例外の受け口(注文 36): 結線の例外 → 読みを点の項目に、登録表 → 自分のドメインの plugs、依存の例外 → requires・gate・required/" });
  if (existsSync(join(root, "scripts/proxies"))) for (const name of readdirSync(join(root, "scripts/proxies"))) if (name.startsWith("alwaysOnExceptions.")) hand.push({ path: `scripts/proxies/${name}`, text: "消した例外の受け口(注文 36)" });
  // 手の作業: 上流の枠に fork が足した部品でドメインを読む物
  if (added.status === "ok") {
    const decided = [...moves.map((m) => m.from), ...stops.map((s) => s.path)];
    const frames = readDistrictMapAt(root).districts.filter((d) => d.kind === "frame").map((d) => d.dir);
    for (const f of [...added.added].sort(byName)) {
      if (!SOURCE.test(f) || TEST.test(f) || /\/__tests__\//.test(f) || !frames.some((dir) => f.startsWith(`${dir}/`)) || !existsSync(join(root, f))) continue;
      // 2 で動かす・止めた物は 2 で扱う(同じ物を手の作業に重ねない)
      if (decided.some((p) => f === p || f.startsWith(`${p}/`))) continue;
      if (/["']@\/domains\//.test(readFileSync(join(root, f), "utf8"))) hand.push({ path: f, text: "上流の枠に足した部品がドメインを読む(lint district-no-domains): 自分のドメインの plugs/<点>/ へ(候補 userHeaderActions・userOverlays・adminOverlays・rootProviders)か、読みを点の項目に" });
    }
  } else if (added.status !== "tier1") hand.push({ path: "-", text: `fork が足したファイルを求められない(${added.reason ?? added.status}): 上流の枠に足した部品は pnpm lint の district-no-domains で見る` });
  // 3. 常設の宣言
  const alwaysOpen = domains.unlisted.map((dir) => ({ dir, path: `${dir}/extensionPoints.ts`, create: !existsSync(join(root, dir, "extensionPoints.ts")) }));
  // 5. lint の名前
  const lintFiles = [];
  for (const top of ["src", "scripts", "eslint-rules"]) for (const f of walk(join(root, top), top)) if (/\.(tsx?|mts|mjs|js)$/.test(f) && readFileSync(join(root, f), "utf8").includes(LINT_OLD)) lintFiles.push(f);
  for (const f of ["eslint.config.fork.mjs"]) if (existsSync(join(root, f)) && readFileSync(join(root, f), "utf8").includes(LINT_OLD)) lintFiles.push(f);
  return { moves, stops, hand, alwaysOpen, lintFiles, removes };
}

const ALWAYS_OPEN_LINE = "\n// 常設(どの機能の規則にも載らず常に開く、明示の宣言 D22・D53)。規則の domains に載せると地区の地図の生成で止まる\nexport const alwaysOpen = true;\n";

/** ForkProviders の書き換え: 段 project と export const provider を足し、もう無い既定の型の再出しを消す */
export function rewriteForkProviders(text) {
  let out = text.replace(/^export\s+type\s*\{[^}]*\}\s*from\s*["'][^"']*ForkProviders\.default["'];?\n\n?/m, "");
  if (!/^export\s+const\s+stage\b/m.test(out)) out += '\n// 段 project(一番内側、前の ForkProviders の口、注文 32)\nexport const stage = "project";\n';
  if (!/^export\s+const\s+provider\b/m.test(out)) out += 'export const provider: RootProvider = ForkProviders;\n';
  if (!/\bRootProvider\b[^\n]*from\s*["']@\/app\/_layout\/points["']/.test(out)) out = out.replace(/((?:^import[^\n]*\n)+)/m, `$1import type { RootProvider } from "@/app/_layout/points";\n`);
  return out;
}

/** 計画を書く(止めた物は書かない) */
export function applyForks(root, plan) {
  const written = [];
  for (const m of plan.moves) {
    mkdirSync(dirname(join(root, m.to)), { recursive: true });
    renameSync(join(root, m.from), join(root, m.to));
    const files = isDir(join(root, m.to)) ? [...walk(join(root, m.to), m.to)] : [m.to];
    for (const file of files.filter((f) => SOURCE.test(f))) {
      const fromFile = m.from + file.slice(m.to.length);
      let text = readFileSync(join(root, file), "utf8");
      text = rewriteRelativeImports(text, fromFile, file, m.from);
      if (m.stage && file === m.to) text += `\n// 段(proxy の鎖の順、src/proxies/extensionPoints.ts の stages。止める物は maintenance・動作の型は mode に直す)\nexport const stage = "${m.stage}";\n`;
      if (m.forkProviders) text = rewriteForkProviders(text);
      writeFileSync(join(root, file), text);
    }
    written.push(m.to);
  }
  for (const f of plan.removes ?? []) {
    rmSync(join(root, f));
    written.push(`-${f}`);
  }
  for (const a of plan.alwaysOpen) {
    const abs = join(root, a.path);
    if (a.create) writeFileSync(abs, `// ${a.path}\n// ${a.dir} の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。拡張点は持たない${ALWAYS_OPEN_LINE}`);
    else writeFileSync(abs, readFileSync(abs, "utf8").replace(/\s*$/, "\n") + ALWAYS_OPEN_LINE);
    written.push(a.path);
  }
  for (const f of plan.lintFiles) {
    writeFileSync(join(root, f), readFileSync(join(root, f), "utf8").split(LINT_OLD).join(LINT_NEW));
    written.push(f);
  }
  // 空になった古い置き場を消す(README だけ残った物も)
  for (const place of [...OLD_PLACES.map((p) => p.from), ...OLD_RECEPTACLES.map((p) => p.from), "src/app/_providers", "src/app/_layout/adminCommand"]) {
    const abs = join(root, place);
    if (isDir(abs) && [...walk(abs, place)].every((f) => f.endsWith("README.md"))) rmSync(abs, { recursive: true });
  }
  return written;
}

/** 全部を順に(plugs → 古い置き場 → 常設 → 型の入口 → lint の名前) */
export function runForks(root, { apply = false, owners = {} } = {}) {
  const plugs = planPlugs(root, { owners });
  const result = { plugs: { moves: plugs.moves.length, registry: plugs.registry.length, conversions: plugs.conversions.length, stops: plugs.stops }, written: [] };
  if (apply && plugs.stops.length === 0) applyPlugs(root, plugs);
  const forks = planForks(root, { owners });
  Object.assign(result, { moves: forks.moves, stops: forks.stops, hand: forks.hand, alwaysOpen: forks.alwaysOpen, lintFiles: forks.lintFiles, removes: forks.removes });
  if (apply && forks.stops.length === 0) result.written.push(...applyForks(root, forks));
  const points = planPointsEntries(root);
  result.points = points.files.map((f) => ({ path: f.path, moved: f.moved, stops: f.stops }));
  if (apply && forks.stops.length === 0) result.written.push(...applyPointsEntries(root, points));
  result.stopCount = plugs.stops.length + forks.stops.length + points.files.filter((f) => f.stops.length > 0).length;
  return result;
}

function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const owners = Object.fromEntries(args.flatMap((a, i) => (a === "--owner" && args[i + 1] ? [args[i + 1].split("=")] : [])));
  const r = runForks(process.cwd(), { apply, owners });
  if (args.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`[段 3 の fork の手当て] ${apply ? "apply" : "dry-run"}`);
    console.log(`1. plugs: 点の書き換え ${r.plugs.conversions}・項目 ${r.plugs.moves}・登録表のフォルダ ${r.plugs.registry}(詳しくは node .notices/20261123-040814-district-stage3.plugs.mjs)`);
    for (const s of r.plugs.stops) console.log(`   止める ${s.path}: ${s.text}`);
    console.log(`2. 古い置き場の項目: ${r.moves.length}`);
    for (const m of r.moves) console.log(`   ${m.from} → ${m.to}(${m.rule}${m.stage ? `、段 ${m.stage}` : ""})`);
    for (const s of r.stops) console.log(`   止める ${s.path}: ${s.text}${s.reads?.length ? `(読む ${s.reads.join("・")})` : ""}${s.candidates.length ? `(候補 ${s.candidates.join("・")}、--owner ${s.path}=<フォルダ>)` : ""}`);
    for (const f of r.removes) console.log(`   消す ${f}(上流が消した 1 行スイッチ)`);
    console.log(`3. 常設の宣言: ${r.alwaysOpen.length}`);
    for (const a of r.alwaysOpen) console.log(`   ${a.path}${a.create ? "(新しく作る)" : ""}`);
    console.log(`4. 型だけの入口: ${r.points.length} ファイル`);
    for (const p of r.points) for (const m of p.moved) console.log(`   ${p.path}: ${m.names.join(", ")} ${m.from} → ${m.entry}`);
    console.log(`5. lint の名前(${LINT_OLD} → ${LINT_NEW}): ${r.lintFiles.length}`);
    for (const f of r.lintFiles) console.log(`   ${f}`);
    console.log(`手の作業: ${r.hand.length}`);
    for (const h of r.hand) console.log(`   ${h.path}: ${h.text}`);
    console.log(`止めた物: ${r.stopCount}${apply ? "" : "。dry-run: --apply で書く(止めた物があれば書かない)"}`);
    if (apply) console.log("次: 手の作業 → pnpm generate extensions・pnpm generate registry・pnpm generate district-map");
  }
  if (r.stopCount > 0) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
