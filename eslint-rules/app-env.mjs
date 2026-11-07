// eslint-rules/app-env.mjs
//
// 段階の読み手は 1 つだけ(本部 D178)。process.env.APP_ENV / process.env.NODE_ENV を直接読まず、
// @/lib/appEnv(getAppEnv・isDevelopment・isStaging・isProduction)を通す。
// NODE_ENV は Next の外(scripts・node --test)で空になり、staging でも production になるので段階を表せない。
// 値が無い・知らない値を production として扱う決まりも読み手の 1 か所に置く。
//
// 止めるもの: process.env.APP_ENV / process.env.NODE_ENV / process.env["APP_ENV"] / `const { APP_ENV } = process.env`
// (globalThis.process.env・`process.env as X` も同じ)。process.env を別名に置いた読み(`const env = process.env; env.NODE_ENV`)も止める。代入の左辺(テストの差し替え)も止める → withAppEnv / setAppEnv を使う。
// 対象外(eslint.config.mjs の ignores): 読み手の src/lib/appEnv/ だけ。
// 強さはリポジトリ単位: 上流リポ(目録の先頭の節)= error、fork = warn。

const NAMES = new Set(["APP_ENV", "NODE_ENV"]);

const propName = (node) => {
  if (!node.computed && node.property.type === "Identifier") return node.property.name;
  if (node.computed && node.property.type === "Literal" && typeof node.property.value === "string") return node.property.value;
  return null;
};

/** TS の型の注記(as・!・satisfies)を外す */
const unwrap = (node) => {
  let current = node;
  while (current && ["TSAsExpression", "TSNonNullExpression", "TSSatisfiesExpression", "TSTypeAssertion"].includes(current.type)) {
    current = current.expression;
  }
  return current;
};

/** node が process.env(globalThis.process.env 等も)か */
const isProcessEnv = (raw) => {
  const node = unwrap(raw);
  if (!node || node.type !== "MemberExpression" || propName(node) !== "env") return false;
  const obj = node.object;
  if (obj.type === "Identifier") return obj.name === "process";
  return obj.type === "MemberExpression" && propName(obj) === "process" && obj.object.type === "Identifier" && ["globalThis", "global", "window", "self"].includes(obj.object.name);
};

const rule = {
  meta: {
    type: "problem",
    docs: { description: "APP_ENV / NODE_ENV を直接読まず @/lib/appEnv を使う" },
    messages: {
      direct:
        "process.env.{{name}} を直接読まず @/lib/appEnv(getAppEnv・isDevelopment・isStaging・isProduction。テストの差し替えは withAppEnv / setAppEnv)を使います。NODE_ENV は段階を表せません。詳細: eslint-rules/app-env.mjs",
    },
    schema: [],
  },
  create(context) {
    // process.env を置いた別名(このファイルの中の名前)
    const aliases = new Set();
    const isEnvObject = (node) => {
      const target = unwrap(node);
      return isProcessEnv(target) || (target?.type === "Identifier" && aliases.has(target.name));
    };
    return {
      "VariableDeclarator[id.type='Identifier']"(node) {
        if (node.init && isProcessEnv(node.init)) aliases.add(node.id.name);
      },
      MemberExpression(node) {
        if (!isEnvObject(node.object)) return;
        const name = propName(node);
        if (name && NAMES.has(name)) context.report({ node, messageId: "direct", data: { name } });
      },
      VariableDeclarator(node) {
        if (node.id.type !== "ObjectPattern" || !node.init || !isEnvObject(node.init)) return;
        for (const prop of node.id.properties) {
          if (prop.type !== "Property") continue;
          const key = !prop.computed && prop.key.type === "Identifier" ? prop.key.name : prop.key.type === "Literal" ? prop.key.value : null;
          if (key && NAMES.has(key)) context.report({ node: prop, messageId: "direct", data: { name: key } });
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-app-env", version: "1.0.0" },
  rules: { "single-reader": rule },
};

export default plugin;
