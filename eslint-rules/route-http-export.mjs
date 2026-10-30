// eslint-rules/route-http-export.mjs
//
// src/app/**/route.{ts,tsx} の HTTP の export(GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS)は、
// 認可を構造で持つ作り手の呼び出し結果だけにする(D8 K7・親 D71 K6)。強さ: 全 Tier error(eslint.config.mjs)。
//
// 通す形: `export const GET = <関数>(…)` で、<関数> が次から import した物
//   - src/wiring/**(@/wiring/apiRoute の createApiRoute 等。fork のドット名の wiring を含む)
//   - @/lib/cron の createCronTaskRoute / createCronRoute(cron の 1 行の route.ts)
//   import の先は resolve-import.mjs で実パスに解く(別名・相対・"src/…" も同じ)。
// 止める形: export function / export async function / 関数式・アロー関数の直書き / 識別子の再 export(export { GET })/
//   export … from / 分割代入の export(export const { GET } = …)/ wiring・lib/cron 以外の関数の呼び出し。
// 理由: route ごとに主体を引いて門を書くと、渡し忘れ・token だけのセッションでの判定が紛れ込む。
//   主体の解き方と access の評価は Factory が持ち、route は宣言だけを書く(src/lib/routeFactory/README.md)。
//
// 置き換えた物: route-authz/require-authz(access "custom" の route に「認可の痕跡」があるかを見る警告)。
//   custom は廃止されたので、痕跡の名前の一覧(AUTH_SIGNALS)も持たない。

import { isUnder, resolveImport } from "./resolve-import.mjs";

export const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const CRON_FACTORIES = new Set(["createCronTaskRoute", "createCronRoute"]);

/** 呼び出しの元の関数名(createApiRoute(…) / createApiRoute<P>(…) とも Identifier の callee) */
function calleeName(init) {
  if (!init || init.type !== "CallExpression") return null;
  return init.callee.type === "Identifier" ? init.callee.name : null;
}

const repoRootOf = (context) => context.cwd ?? context.getCwd?.() ?? process.cwd();

const httpExport = {
  meta: {
    type: "problem",
    docs: { description: "route.ts の HTTP の export は wiring の Factory か lib/cron の作り手の呼び出し結果だけ" },
    messages: {
      notFactory:
        "{{method}} は wiring の Factory(@/wiring/apiRoute の createApiRoute 等)か @/lib/cron の作り手(createCronTaskRoute / createCronRoute)の呼び出し結果にする。主体と access は Factory が持つ(詳細: src/lib/routeFactory/README.md)",
      shape:
        "{{method}} は `export const {{method}} = createApiRoute(…)` の形で書く(関数の直書き・再 export・分割代入の export は不可。詳細: src/lib/routeFactory/README.md)",
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    /** 作り手として通す local 名(wiring の import 全部と lib/cron の作り手) */
    const allowedLocals = new Set();
    /** 判定を待つ export の宣言(import は巻き上げられるので、ファイルを読み終えてから判定する) */
    const pending = [];

    const checkDeclarator = (declarator) => {
      if (declarator.id.type !== "Identifier") {
        // 分割代入の export に HTTP の名前が含まれていれば止める
        const names = [];
        const collect = (pattern) => {
          if (!pattern) return;
          if (pattern.type === "Identifier") names.push(pattern.name);
          else if (pattern.type === "ObjectPattern") pattern.properties.forEach((p) => collect(p.type === "RestElement" ? p.argument : p.value));
          else if (pattern.type === "ArrayPattern") pattern.elements.forEach(collect);
          else if (pattern.type === "AssignmentPattern") collect(pattern.left);
        };
        collect(declarator.id);
        for (const name of names) {
          if (HTTP_METHODS.has(name)) context.report({ node: declarator, messageId: "shape", data: { method: name } });
        }
        return;
      }
      const method = declarator.id.name;
      if (!HTTP_METHODS.has(method)) return;
      const name = calleeName(declarator.init);
      if (!name || !allowedLocals.has(name)) {
        context.report({ node: declarator, messageId: "notFactory", data: { method } });
      }
    };

    return {
      ImportDeclaration(node) {
        if (node.importKind === "type" || typeof node.source.value !== "string") return;
        const resolved = resolveImport(node.source.value, context.filename, repoRoot);
        const fromWiring = isUnder(resolved, "src/wiring");
        const fromCron = isUnder(resolved, "src/lib/cron");
        if (!fromWiring && !fromCron) return;
        for (const spec of node.specifiers) {
          if (spec.type !== "ImportSpecifier" || spec.importKind === "type") continue;
          const imported = spec.imported.type === "Identifier" ? spec.imported.name : String(spec.imported.value);
          if (fromWiring || CRON_FACTORIES.has(imported)) allowedLocals.add(spec.local.name);
        }
      },
      ExportNamedDeclaration(node) {
        if (node.exportKind === "type") return;
        const decl = node.declaration;
        if (decl?.type === "VariableDeclaration") {
          pending.push(...decl.declarations);
          return;
        }
        if (decl?.type === "FunctionDeclaration" && decl.id && HTTP_METHODS.has(decl.id.name)) {
          context.report({ node: decl, messageId: "shape", data: { method: decl.id.name } });
          return;
        }
        for (const spec of node.specifiers ?? []) {
          const exported = spec.exported.type === "Identifier" ? spec.exported.name : String(spec.exported.value);
          if (HTTP_METHODS.has(exported) && spec.exportKind !== "type") {
            context.report({ node: spec, messageId: "shape", data: { method: exported } });
          }
        }
      },
      "Program:exit"() {
        pending.forEach(checkDeclarator);
      },
      ExportAllDeclaration(node) {
        // export * from は HTTP の名前を持ち込めるので止める(route.ts に要る形ではない)
        context.report({ node, messageId: "shape", data: { method: "export *" } });
      },
    };
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-route-http-export", version: "1.0.0" },
  rules: { "http-export": httpExport },
};

export default plugin;
