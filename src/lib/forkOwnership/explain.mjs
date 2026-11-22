// pnpm workflow ownership who の型の答え: 上流のパスごとに「fork はこれを変えたいとき何をするか」(git には触れない。読む木は呼び手が渡す)。
// 型: 1 丸ごと(1 行スイッチ・画面の page.tsx / 枠の layout.tsx)/ 2 重ね(<対象>.override.ts・frame.override.ts、鍵 = 宣言の overrideOf)/
//     3 足す(受け口)/ 4 置き場(地区の config の上書き・placement の点)/ 5 自分の版(受け口の一覧の self の行)/ generated(生成器で作り直す)/
//     own(この fork の物)/ none(/order <直接の親>)。判定の順: generated → 5 → own → 1 → 2 / 3 → 4 → (own | none)。読むのは宣言(extensionPoints.ts)・地区の見つけ方・ルート・1 行スイッチの名前の決まり・
// 受け口の一覧の kind・生成器の phase.json(pnpm generate domain の出力の種類も scripts/structure/domain/phase.json の outputs)。受け口の一覧の行の注記の文言は読まない。
// 仕様: ./README.md「持ち主を調べる(pnpm workflow ownership who)」

import { matchesGlob } from "node:path";

import { pointsFromFiles, isListPoint, FRAME_FILE, FRAME_OVERRIDE_FILE, FRAME_SEARCH_ROOT, overridePathOfTarget, switchSetOf, configSlotsOf, discoverDistricts } from "../districtMap/index.mjs";
import { DOMAIN_OUTPUTS_FILE, intakeOutputGlobs, matchDomainOutput, parseDomainOutputs } from "../districtMap/node.mjs";
import { parseSwitchLayout, LAYOUT_FILE_RE, PAGE_FILE_RE, discoverRoutes } from "../screens/node.mjs";
import { matchIntake } from "./intake.mjs";

/**
 * @import { SwitchTarget } from "../screens/node.mjs"
 * @import { IntakeRule } from "./intake.mjs"
 * @typedef {ReturnType<typeof pointsFromFiles>["points"][number]} DeclaredPoint 宣言の点(pointsFromFiles の 1 件)
 * @typedef {{ type: string, keys: string[] | null, write: string | null, source: string | null, how?: string, order?: string }} ExplainAnswer 型の答え
 * @typedef {"tier1" | "middle" | "fork" | "missing"} ExplainTier
 */

/** 型の値(L1.45) */
export const EXPLAIN_TYPES = ["1", "2", "3", "4", "5", "generated", "own", "none"];

const GATE_FILE = /^scripts\/structure\/([^/]+)\/gate\.json$/;
const DOMAIN_JSON = /^src\/domains\/(?:core\/)?[^/_][^/]*\/domain\.json$/;
const SCREEN_PART_DIRS = ["_screen", "_layout"];
const FORK_SCREEN_DIR = "_components";
const FRAME_KEYS = ["layout", "page"];

const dirOf = (/** @type {string} */ path) => path.slice(0, Math.max(path.lastIndexOf("/"), 0));
const baseName = (/** @type {string} */ path) => path.slice(path.lastIndexOf("/") + 1);
const literalBrackets = (/** @type {string} */ glob) => glob.replace(/[[\]]/g, (ch) => `[${ch}]`);
/**
 * 素のオブジェクト(配列・null でない)か
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
/** 文字列の配列の値(文字列以外の要素と、配列でない値は落とす) */
const stringsOf = (/** @type {unknown} */ value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);
/**
 * 一度だけ作り、2 回目からは同じ物を返す
 * @template T
 * @param {() => T} make
 * @returns {() => T}
 */
const lazy = (make) => {
  /** @type {{ value: T } | null} */
  let made = null;
  return () => (made ??= { value: make() }).value;
};
/**
 * @param {string} text
 * @returns {unknown} 読めなければ null
 */
const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/**
 * 判定に使う木の見え方(一度だけ作り、パスごとに使い回す。重い物は要るときに読む)
 * @param {{ files: Iterable<string>, read: (path: string) => string | null, intake: IntakeRule[] }} tree
 *   files = 判定する木のファイル(Tier1 は HEAD、fork は直接の親との基準)、read = その木の本文、intake = その木の受け口の一覧
 */
export function explainView({ files, read, intake }) {
  const fileSet = new Set(files);
  const list = [...fileSet].sort();
  return {
    has: (/** @type {string} */ path) => fileSet.has(path),
    read,
    intake,
    /** @type {() => DeclaredPoint[]} */
    points: lazy(() => pointsFromFiles(list, read).points),
    routes: lazy(() => {
        const { routes } = discoverRoutes(list.filter((f) => f.startsWith(`${FRAME_SEARCH_ROOT}/`)));
        const pages = new Set(routes.map((r) => r.page));
        const layouts = [...new Set(routes.flatMap((r) => r.layouts))];
        // 枠の 1 行スイッチの layout.tsx → その向け先(parseSwitchLayout の target)
        /** @type {Map<string, SwitchTarget>} */
        const frameSwitches = new Map();
        for (const path of layouts) {
          const target = parseSwitchLayout(read(path) ?? "").target;
          if (target) frameSwitches.set(path, target);
        }
        return { pages, frameSwitches };
      }),
    generators: lazy(() =>
        list.flatMap((path) => {
          const match = GATE_FILE.exec(path);
          const decl = match ? parseJson(read(path) ?? "") : null;
          return match && isRecord(decl) ? [{ name: match[1], globs: [...intakeOutputGlobs(decl.outputs), ...stringsOf(decl.regions)] }] : [];
        }),
      ),
    domainOutputs: lazy(() => {
        const text = fileSet.has(DOMAIN_OUTPUTS_FILE) ? read(DOMAIN_OUTPUTS_FILE) : null;
        const outputs = text === null ? [] : parseDomainOutputs(text).outputs;
        const domains = list
          .filter((path) => DOMAIN_JSON.test(path))
          .map((path) => ({ dir: dirOf(path), config: parseJson(read(path) ?? "") }))
          .map(({ dir, config }) => ({
            dir,
            plural: isRecord(config) && typeof config.plural === "string" ? config.plural : undefined,
            generate: !(isRecord(config) && config.generate === false),
          }));
        return { outputs, domains };
      }),
    districts: lazy(() => {
        /** @type {Map<string, Map<string, boolean>>} */
        const children = new Map();
        for (const path of list) {
          const parts = path.split("/");
          for (let i = 1; i <= parts.length; i += 1) {
            const parent = parts.slice(0, i - 1).join("/");
            const entries = children.get(parent) ?? new Map();
            entries.set(parts[i - 1], i < parts.length);
            children.set(parent, entries);
          }
        }
        const source = {
          listDir: (/** @type {string} */ rel) => [...(children.get(rel)?.entries() ?? [])].map(([name, isDir]) => ({ name, isDir })).sort((a, b) => (a.name < b.name ? -1 : 1)),
          readText: (/** @type {string} */ rel) => (fileSet.has(rel) ? read(rel) : null),
        };
        return discoverDistricts(source).districts;
      }),
  };
}

/** @typedef {ReturnType<typeof explainView>} ExplainViewOf */

/**
 * @param {string} type
 * @param {Partial<Omit<ExplainAnswer, "type">>} [fields]
 * @returns {ExplainAnswer}
 */
const answer = (type, fields = {}) => ({ type, keys: null, write: null, source: null, ...fields });

/**
 * generated: 受け口の一覧の generated / region の行か、pnpm generate domain が毎回書くファイル(generate: false のドメインを除く)
 * @param {string} path
 * @param {ExplainViewOf} view
 * @returns {ExplainAnswer | null}
 */
function generatedOf(path, view) {
  const rule = matchIntake(view.intake, path);
  if (rule?.kind === "generated" || rule?.kind === "region") {
    const generator = view.generators().find((g) => g.globs.includes(rule.glob));
    const command = generator ? `pnpm generate ${generator.name}` : null;
    return answer("generated", { source: command, how: rule.kind === "region" ? "fork の区画(fork entries の対)の中だけ書き、外は生成器が書く" : "手で直さない。生成器で作り直す" });
  }
  const { outputs, domains } = view.domainOutputs();
  const hit = matchDomainOutput(path, outputs, domains.filter((d) => d.generate));
  // matchDomainOutput は当たった出力を object で返すので、kind を確かめてから読む
  if (hit && "kind" in hit.entry && hit.entry.kind === "every-run") {
    return answer("generated", {
      write: hit.source,
      source: "pnpm generate domain",
      how: `手で直さない。${hit.source ?? "domain.json"} を直して作り直す(最後の手段: ${"dir" in hit.domain ? hit.domain.dir : ""}/domain.json の "generate": false で手書きに移す)`,
    });
  }
  return null;
}

/**
 * 型 1: 1 行スイッチ(<名前>.default の組)と画面・枠のスイッチ(_screen / _layout の部品はルートの page.tsx / layout.tsx)。
 * 画面 = ルートの _components/ に置き換えの Screen を置く。枠 = 既定の隣の _layout/<Layout>.replace.tsx(<Layout> = layout.tsx の向け先の名前)
 * @param {string} path
 * @param {ExplainViewOf} view
 * @returns {ExplainAnswer | null}
 */
function replaceOf(path, view) {
  const set = switchSetOf(path);
  const defaultPath = set?.defaults.find(view.has);
  if (set && defaultPath) {
    const ext = defaultPath.slice(defaultPath.lastIndexOf(".") + 1);
    const switchPath = set.switches.find(view.has) ?? set.switches[ext === "tsx" ? 1 : 0];
    return answer("1", { write: `${set.dir}/${set.name}.replace.${ext}`, source: switchPath, how: `${baseName(switchPath)} の向け先を ./${set.name}.replace に替える` });
  }
  const { pages, frameSwitches } = view.routes();
  const screen = (/** @type {string} */ dir, /** @type {string} */ switchPath) => answer("1", { write: `${dir}/${FORK_SCREEN_DIR}/`, source: switchPath, how: `${FORK_SCREEN_DIR}/ に置き換えを置き、画面の 1 行スイッチ ${baseName(switchPath)} を向け替える` });
  const frame = (/** @type {string} */ dir, /** @type {string} */ switchPath) => {
    const target = frameSwitches.get(switchPath);
    if (!target) return null;
    // 向け先が既に <Layout>.replace(上の Tier が置き換え済み)でも同じファイルを答える
    const stem = `${target.screenDir}/${target.file}`.replace(/\.replace$/, "");
    return answer("1", {
      write: `${dir}/${stem}.replace.tsx`,
      source: switchPath,
      how: `既定の隣に ${stem.split("/").pop()}.replace.tsx を置き、枠の 1 行スイッチ ${baseName(switchPath)} を ./${stem}.replace に向け替える(fork の枠の部品はルートの ${FORK_SCREEN_DIR}/ に印なしの名前)`,
    });
  };
  if (pages.has(path)) return screen(dirOf(path), path);
  if (frameSwitches.has(path)) return frame(dirOf(path), path);
  if (!path.startsWith(`${FRAME_SEARCH_ROOT}/`)) return null;
  const segments = path.split("/");
  const at = segments.findIndex((seg, i) => i > 1 && i < segments.length - 1 && SCREEN_PART_DIRS.includes(seg));
  if (at < 0) return null;
  const dir = segments.slice(0, at).join("/");
  if (segments[at] === "_screen") {
    const page = [...pages].find((p) => dirOf(p) === dir && PAGE_FILE_RE.test(baseName(p)));
    return page ? screen(dir, page) : null;
  }
  const layout = [...frameSwitches.keys()].find((p) => dirOf(p) === dir && LAYOUT_FILE_RE.test(baseName(p)));
  return layout ? frame(dir, layout) : null;
}

/**
 * 受け口の点のフォルダ(持ち主のフォルダ + dir、"." = 持ち主の直下)
 * @param {DeclaredPoint} point
 * @param {string} dir 点の dir
 */
const receptacleDirOf = (point, dir) => (dir === "." ? point.owner : `${point.owner}/${dir.replace(/^\.\//, "").replace(/\/+$/, "")}`);
const sourceOf = (/** @type {DeclaredPoint} */ point) => `${point.declaredIn} ${point.name}`;

/** 対象の glob が「1 フォルダ = 1 単位」の形か(最後のフォルダが * 1 つで、ファイル名が決まっている: src/app/api/cron/*\/task.ts) */
const isFolderUnitGlob = (/** @type {string} */ glob) => {
  const parts = glob.split("/");
  return parts.length >= 3 && parts[parts.length - 2] === "*" && !/[*?[{]/.test(parts[parts.length - 1]);
};

/**
 * 型 2 / 3: 上書きの対象の点・受け口の項目の上書き・枠の宣言・受け口に足す
 * @param {string} path
 * @param {ExplainViewOf} view
 * @returns {ExplainAnswer | null}
 */
function overlayOf(path, view) {
  const points = view.points();
  for (const point of points) {
    const glob = point.spec.overrides;
    if (typeof glob !== "string") continue;
    let target = matchesGlob(path, glob) ? path : null;
    // 1 フォルダ = 1 単位の点(glob が <置き場>/*/<決まった名前>、cron の task.ts): そのフォルダのどのファイルも、その対象を上書きして変える。
    // 決まった名前でもフォルダが単位でない点(domainEntry.ts の隣の userService.ts など)の隣のファイルは対象にしない
    if (!target && isFolderUnitGlob(glob)) {
      const candidate = `${dirOf(path)}/${baseName(glob)}`;
      if (matchesGlob(candidate, glob) && view.has(candidate)) target = candidate;
    }
    if (target) return answer("2", { keys: stringsOf(point.spec.overrideOf), write: overridePathOfTarget(target), source: sourceOf(point) });
  }
  if (path.startsWith(`${FRAME_SEARCH_ROOT}/`) && [FRAME_FILE, FRAME_OVERRIDE_FILE].includes(baseName(path))) {
    const dir = dirOf(path);
    const { pages } = view.routes();
    const routeHere = [...pages].some((p) => dirOf(p) === dir) || [...view.routes().frameSwitches.keys()].some((p) => dirOf(p) === dir) || view.has(`${dir}/layout.tsx`);
    if (routeHere) {
      const creator = view.has(`${dir}/${FRAME_FILE}`);
      return answer("2", { keys: FRAME_KEYS, write: `${dir}/${FRAME_OVERRIDE_FILE}`, source: creator ? `${dir}/${FRAME_FILE}` : null, how: creator ? `${FRAME_FILE} の上に重ねる` : `ルートを作ったリポの ${FRAME_FILE} が無い(空の基準に重ねる)` });
    }
  }
  for (const point of points) {
    if (!isListPoint(point.spec) || typeof point.spec.dir !== "string") continue;
    const dir = receptacleDirOf(point, point.spec.dir);
    if (!path.startsWith(`${dir}/`)) continue;
    const direct = dirOf(path) === dir;
    if (direct && view.has(path) && point.spec.overrideOf) {
      return answer("2", { keys: stringsOf(point.spec.overrideOf), write: overridePathOfTarget(path), source: sourceOf(point) });
    }
    return answer("3", { write: view.has(path) ? `${dir}/<名前>.ts` : path, source: sourceOf(point), how: "受け口に項目を足す(印なしの名前)" });
  }
  return null;
}

/**
 * 型 4: 地区の config の上書き・placement の点(そのものか、宣言のフォルダの物と対になる直下の物)
 * @param {string} path
 * @param {ExplainViewOf} view
 * @returns {ExplainAnswer | null}
 */
function placementOf(path, view) {
  const name = baseName(path);
  if (name === "config.ts" || name === "config.ui.ts") {
    for (const district of view.districts()) {
      const slots = configSlotsOf(district);
      if (path === slots.config) return answer("4", { write: slots.override, source: `${district.kind} ${district.name}`, how: "地区の値は上書きのファイルに変えたいキーだけ書く" });
      if (path === slots.uiConfig) return answer("4", { write: slots.uiOverride, source: `${district.kind} ${district.name}`, how: "描画の値は上書きのファイルに変えたいキーだけ書く" });
    }
  }
  const placements = view.points().flatMap((point) => (typeof point.spec.placement === "string" ? [{ point, placement: point.spec.placement }] : []));
  for (const { point, placement } of placements) {
    if (matchesGlob(path, literalBrackets(placement))) {
      return answer("4", { write: path, source: sourceOf(point), how: point.spec.kind === "append" ? "基準の中身を先頭に残して追記する" : "そのまま書き換える" });
    }
  }
  for (const { point, placement } of placements) {
    const owner = dirOf(point.declaredIn);
    if (!path.startsWith(`${owner}/`)) continue;
    const counterpart = `${dirOf(placement)}/${name}`;
    if (counterpart !== path && view.has(counterpart) && matchesGlob(counterpart, placement)) {
      return answer("4", { write: counterpart, source: sourceOf(point), how: "同じ名前の直下のファイルに変えたい値だけ書く(後から読まれて上書きする)" });
    }
  }
  return null;
}

/**
 * 1 パスの型の答え
 * @param {string} path
 * @param {ExplainViewOf} view
 * @param {{ tier: ExplainTier, addable: boolean, parent: string }} who
 *   tier = 持ち主(who の owner.tier)、addable = 足したときの判定が合格か(missing のとき)、parent = 直接の親の名前(/order の宛先)
 * @returns {ExplainAnswer}
 */
export function explainPath(path, view, { tier, addable, parent }) {
  const generated = generatedOf(path, view);
  if (generated) return generated;
  // 型 5 self: 各リポが自分の版を持つ(取り込みは親の版を採らず、/flux が親の差分を見せ、採る所は自分で写す)
  if (matchIntake(view.intake, path)?.kind === "self")
    return answer("5", { write: path, how: "自分の版を書く(親の版は取り込まない。親の差分は /flux が区切りごとに見せる、採る所は別のコミットで自分で写す)" });
  if (tier === "fork" || tier === "middle") return answer("own", { write: path, how: tier === "fork" ? "この fork の物: そのまま書き換える" : "中間 Tier の物: そのまま書き換える" });
  const typed = replaceOf(path, view) ?? overlayOf(path, view) ?? placementOf(path, view);
  if (typed) return typed;
  if (tier === "missing" && addable) return answer("own", { write: path, how: "足してよい(足したファイルはこの fork の物)" });
  return answer("none", { order: `/order ${parent}`, how: "変える口が無い → 直接の親に依頼する(要るまでの間は一時許可)" });
}
