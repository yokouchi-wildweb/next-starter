// eslint-rules/activity.mjs
//
// cacheComponents の <Activity> は離れたページを隠して状態と ref を保ち、戻ると effect をもう一度走らせる。
// ref の守りで effect を 1 回だけにした初期化(`if (doneRef.current) return; … doneRef.current = true`)は、戻った時に
// ref が立ったままなので走らない(戻ると前の終わった画面が出る。pandora のラッシュのガチャ、受信箱 20261126-111800)。
//
// 止めるもの(once-ref-guard): useRef(false) の ref を、useEffect / useLayoutEffect の callback の中で
// `if (<ref>.current …) return` で見張り、その callback の中で `<ref>.current = true` にし、ファイルのどこでも false に戻さず、
// useOnPageLeave(@/lib/pageLeave)も呼ばないもの。
// 直し方: 訪れるたびに要る初期化 → useOnPageLeave で ref と状態を戻す。戻ってもそのままが正しい物(下書き・1 回だけの発火)→
// 理由つきの eslint-disable-next-line。決まり: .claude/rules/core/client.md activity_state
// 強さはリポジトリ単位: 上流リポ(目録の先頭の節)= error、fork = warn。

const EFFECT_HOOKS = new Set(["useEffect", "useLayoutEffect"]);

/** @param {any} node */
const calleeName = (node) => (node.callee.type === "Identifier" ? node.callee.name : node.callee.type === "MemberExpression" && node.callee.property.type === "Identifier" ? node.callee.property.name : null);

/** node が `<name>.current` か */
const isCurrentOf = (node, name) =>
  node?.type === "MemberExpression" && !node.computed && node.property.type === "Identifier" && node.property.name === "current" && node.object.type === "Identifier" && node.object.name === name;

/** 式の中に `<name>.current` があるか(論理式・否定の中も) */
function mentions(node, name) {
  if (!node || typeof node !== "object") return false;
  if (isCurrentOf(node, name)) return true;
  if (node.type === "LogicalExpression" || node.type === "BinaryExpression") return mentions(node.left, name) || mentions(node.right, name);
  if (node.type === "UnaryExpression") return mentions(node.argument, name);
  return false;
}

/** 木を歩く(親を持たない素朴な歩き) */
function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    const child = node[key];
    if (Array.isArray(child)) for (const item of child) walk(item, visit);
    else if (child && typeof child.type === "string") walk(child, visit);
  }
}

const isReturnOnly = (statement) => statement.type === "ReturnStatement" || (statement.type === "BlockStatement" && statement.body.length >= 1 && statement.body.at(-1).type === "ReturnStatement");

const onceRefGuard = {
  meta: {
    type: "problem",
    docs: { description: "<Activity> の下で ref の守りの 1 回だけの初期化を、戻した時の後片付けなしに書かない" },
    messages: {
      once:
        "ref {{name}} で effect を 1 回だけにしていますが、どこでも戻していません。<Activity> は離れたページの ref を保つので、戻った時に初期化が走りません。訪れるたびに要るなら useOnPageLeave(@/lib/pageLeave)で戻す。戻ってもそのままが正しいなら理由つきで disable。詳細: eslint-rules/activity.mjs",
    },
    schema: [],
  },
  create(context) {
    /** @type {Set<string>} useRef(false) の名前 */
    const falseRefs = new Set();
    /** @type {Set<string>} どこかで false に戻す ref */
    const resetRefs = new Set();
    /** @type {{ name: string, node: any }[]} effect の中で見張って true にする所 */
    const guarded = [];
    let usesPageLeave = false;
    return {
      VariableDeclarator(node) {
        const init = node.init;
        if (node.id.type === "Identifier" && init?.type === "CallExpression" && calleeName(init) === "useRef" && init.arguments[0]?.type === "Literal" && init.arguments[0].value === false) {
          falseRefs.add(node.id.name);
        }
      },
      AssignmentExpression(node) {
        if (node.right.type === "Literal" && node.right.value === false && node.left.type === "MemberExpression" && node.left.object.type === "Identifier") {
          resetRefs.add(node.left.object.name);
        }
      },
      CallExpression(node) {
        const name = calleeName(node);
        if (name === "useOnPageLeave") usesPageLeave = true;
        if (!EFFECT_HOOKS.has(name ?? "")) return;
        const callback = node.arguments[0];
        if (!callback || (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression") || callback.body.type !== "BlockStatement") return;
        const watched = new Set();
        for (const statement of callback.body.body) {
          if (statement.type === "IfStatement" && isReturnOnly(statement.consequent)) {
            for (const refName of falseRefs) if (mentions(statement.test, refName)) watched.add(refName);
          }
        }
        if (watched.size === 0) return;
        walk(callback.body, (inner) => {
          if (inner.type === "AssignmentExpression" && inner.right.type === "Literal" && inner.right.value === true) {
            for (const refName of watched) if (isCurrentOf(inner.left, refName)) guarded.push({ name: refName, node: inner });
          }
        });
      },
      "Program:exit"() {
        if (usesPageLeave) return;
        for (const { name, node } of guarded) {
          if (!resetRefs.has(name)) context.report({ node, messageId: "once", data: { name } });
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-activity", version: "1.0.0" },
  rules: { "once-ref-guard": onceRefGuard },
};

export default plugin;
