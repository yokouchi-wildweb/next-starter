// eslint-rules/entry.mjs
//
// 入口の規則(1 つ。D85): 部品・lib は入口からだけ読む。値も型も、静的・dynamic import・require・re-export も同じ。
// 読む先を実パスに解いて(resolve-import.mjs。別名・相対・"src/…" で抜けられない)、次の 3 種を見る:
//   1. 棚の単位 src/components/<Category>/<Unit>: 入口 = <Unit>.<拡張子> のファイルか <Unit>/index.*。中のファイルは外から読まない
//   2. core のドメインの部品 src/domains/core/<domain>/components/(common/)<Part>: 入口 = <Part>.tsx か <Part>/index.*
//   3. 宣言済みの lib(package.json を持つ src/lib/<name>): exports の入口だけ。宣言済みの lib の中からは
//      "libs" に書いた lib の入口・"peers" に書いた棚・"@lib-config/<自分>"(描画専用は "@lib-config/<自分>.ui"、口の決まりは scripts/structure/lib-package/configSlots.mjs)と外部パッケージだけを読む(宣言の読み手 src/lib/libPackage)
// - 同じ単位・同じ部品・同じ lib の中からの読みは見ない(中の組み立ては自由)
// - 生成された一覧(…/extensions/<file>)は受け口の項目を読むのが仕事なので見ない
// - 生成の印のあるファイル(src/wiring/*.ts などの結び目)が lib の項目 src/lib/<lib>/plugs/** を読むのは通す(項目は exports に出さない)。
//   印のあるファイルでも plugs の外の lib の中身は見る
// - テストのデータ __fixtures__ は、テスト(*.test.*)から読むときだけ単位として数えない
// - 全 Tier で error。行の例外は置かない: 足りない入口は持ち主が足す

import { LIB_CONFIG_PREFIX, libConfigSlots } from "../scripts/structure/lib-package/configSlots.mjs";
import { findEntry, libOfPath, PEER_DIRS } from "../src/lib/libPackage/index.mjs";
import { readLibPackage } from "../src/lib/libPackage/node.mjs";
import { isUnder, moduleVisitors, repoRelative, resolveImport } from "./resolve-import.mjs";

const SHELF_UNIT = /^src\/components\/([^/]+)\/([^/]+)\/(.+)$/;
const CORE_UI_PART = /^(src\/domains\/core\/[^/]+\/components\/(?:common\/)?[^/]+)\/(.+)$/;
const ENTRY = /^index(\.(ts|tsx|mts|mjs|js|cjs))?$/;
const GENERATED_LIST = /\/extensions\/[^/]+$/;
const GENERATED_MARK = "// 生成物・編集不可: ";
const LIB_PLUG = /^src\/lib\/[^/]+\/plugs\//;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const FIXTURES = "__fixtures__";

/**
 * 解いたパスが棚の単位の中身を指すなら、その単位のフォルダ(src/components/<Category>/<Unit>)を返す。入口・単位の外なら null
 * @param {string | null} resolved repo 相対の実パス
 */
export function shelfUnitFolderOf(resolved) {
  if (!resolved) return null;
  const match = SHELF_UNIT.exec(resolved);
  if (!match) return null;
  return ENTRY.test(match[3]) ? null : `src/components/${match[1]}/${match[2]}`;
}

/**
 * 解いたパスが core の部品の中身を指すなら、その部品のフォルダを返す。入口や部品の外なら null
 * @param {string | null} resolved repo 相対の実パス
 */
export function corePartFolderOf(resolved) {
  if (!resolved) return null;
  const match = CORE_UI_PART.exec(resolved);
  if (!match) return null;
  // components/common/<Part>.tsx は入口(CORE_UI_PART は common を任意にするので、common そのものの直下を除く)
  if (match[1].endsWith("/components/common")) return null;
  return ENTRY.test(match[2]) ? null : match[1];
}

/** import 元がそのフォルダの外か */
export const isOutside = (importer, folder) => !importer.startsWith(`${folder}/`);

const SCHEMA = [
  {
    type: "object",
    properties: { root: { type: "string" } },
    additionalProperties: false,
  },
];

const repoRootOf = (context) => context.options[0]?.root ?? context.cwd ?? context.getCwd?.() ?? process.cwd();

const rule = {
  meta: {
    type: "problem",
    docs: { description: "棚の単位・core の部品・宣言済みの lib は入口からだけ読む(値も型も)。宣言済みの lib は宣言した物だけを読む" },
    messages: {
      shelfInner:
        '"{{source}}" は棚の単位 {{unit}} の中のファイルです。入口({{unit}}.tsx か {{unit}}/index)から読んでください(足りなければ入口に足す。core/components.md)',
      coreInner:
        '"{{source}}" は部品 {{part}} の中のファイルです。入口({{part}} の index か、{{part}}.tsx)から読んでください(CLAUDE.md core_ui)',
      libInner:
        '"{{source}}": lib {{lib}} の中のファイルは読みません。{{lib}}/package.json の exports の入口から読みます(入口が足りなければ exports に足す。詳細: src/lib/README.md)',
      undeclaredLib:
        '"{{source}}": lib {{own}} は lib {{lib}} を宣言していません。読むなら {{own}}/package.json の "libs" に "{{lib}}" を足します(src/lib/README.md)',
      undeclaredPath:
        '"{{source}}": lib {{own}} は lib の外({{resolved}})を読みません。読めるのは "libs" に書いた lib の入口、"peers" に書いた棚、"@lib-config/{{own}}"(描画専用は "@lib-config/{{own}}.ui")だけです(src/lib/README.md)',
      libConfigOther: '"{{source}}": lib {{own}} が読める上書きは "@lib-config/{{own}}" と描画専用の "@lib-config/{{own}}.ui" だけです(src/lib/README.md)',
    },
    schema: SCHEMA,
  },
  create(context) {
    const root = repoRootOf(context);
    const importer = repoRelative(context.filename, root);
    if (GENERATED_LIST.test(importer)) return {};
    const isTest = TEST_FILE.test(importer);
    const isGenerated = (context.sourceCode ?? context.getSourceCode()).text.startsWith(GENERATED_MARK);
    const ownLib = libOfPath(importer);
    const ownPkg = ownLib ? readLibPackage(root, ownLib) : null;

    return moduleVisitors(({ node, source }) => {
      if (source.startsWith(LIB_CONFIG_PREFIX)) {
        if (ownPkg && !libConfigSlots(ownLib).some((slot) => slot.specifier === source)) {
          context.report({ node, messageId: "libConfigOther", data: { source, own: ownLib } });
        }
        return;
      }
      const resolved = resolveImport(source, context.filename, root);
      if (!resolved) return;

      // 1. 棚の単位
      const unit = shelfUnitFolderOf(resolved);
      if (unit && isOutside(importer, unit) && !(isTest && unit.endsWith(`/${FIXTURES}`))) {
        context.report({ node, messageId: "shelfInner", data: { source, unit: unit.replace(/^src\/components\//, "") } });
        return;
      }
      // 2. core の部品
      const part = corePartFolderOf(resolved);
      if (part && isOutside(importer, part)) {
        context.report({ node, messageId: "coreInner", data: { source, part: part.replace(/^src\/domains\/core\//, "") } });
        return;
      }
      // 3. lib
      const targetLib = libOfPath(resolved);
      if (targetLib && targetLib === ownLib) return;
      if (targetLib && isGenerated && LIB_PLUG.test(resolved)) return;
      if (targetLib) {
        if (ownPkg && !ownPkg.libs.includes(targetLib)) {
          context.report({ node, messageId: "undeclaredLib", data: { source, own: ownLib, lib: targetLib } });
          return;
        }
        const targetPkg = readLibPackage(root, targetLib);
        if (targetPkg && !findEntry(targetPkg, resolved)) {
          context.report({ node, messageId: "libInner", data: { source, lib: targetLib } });
        }
        return;
      }
      if (!ownPkg) return;
      if (ownPkg.peers.some((peer) => isUnder(resolved, PEER_DIRS[peer]))) return;
      context.report({ node, messageId: "undeclaredPath", data: { source, own: ownLib, resolved } });
    });
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-entry", version: "1.0.0" },
  rules: { "only-entries": rule },
};

export default plugin;
