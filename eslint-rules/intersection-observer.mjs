// eslint-rules/intersection-observer.mjs
//
// IntersectionObserver を直書きしない(棚の評議会 D148)。要素の表示の監視は @/hooks/useInView に寄せる。
// 手書きの observer は、要素の付け替え・アンマウントでの disconnect・options の変化での作り直しを誤りやすい。
// useInView は ref コールバック・isInView・entry・once・enabled を持ち、後片付けを 1 か所で引き受ける。
//
// 止めるもの: `new IntersectionObserver(...)` と `new window.IntersectionObserver(...)` / `new globalThis.IntersectionObserver(...)`。
// 型としての参照(IntersectionObserverEntry・IntersectionObserverInit)は止めない。
// 対象外(eslint.config.mjs の ignores): useInView 自身と useInfiniteScrollQuery の番兵(役目が違うので寄せない)、テスト。
// 強さはリポジトリ単位: 上流リポ(目録の先頭の節)= error、fork = warn。

const GLOBAL_OBJECTS = new Set(["window", "globalThis", "self"]);

const isObserverCallee = (callee) => {
  if (callee.type === "Identifier") return callee.name === "IntersectionObserver";
  if (callee.type === "MemberExpression" && !callee.computed) {
    return (
      callee.object.type === "Identifier" &&
      GLOBAL_OBJECTS.has(callee.object.name) &&
      callee.property.type === "Identifier" &&
      callee.property.name === "IntersectionObserver"
    );
  }
  return false;
};

const rule = {
  meta: {
    type: "problem",
    docs: { description: "IntersectionObserver を直書きせず @/hooks/useInView を使う" },
    messages: {
      direct:
        "IntersectionObserver を直接作らず @/hooks/useInView を使います(ref・isInView・entry・once・enabled。後片付けはフックが持つ)。詳細: eslint-rules/intersection-observer.mjs",
    },
    schema: [],
  },
  create(context) {
    return {
      NewExpression(node) {
        if (isObserverCallee(node.callee)) context.report({ node, messageId: "direct" });
      },
    };
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-intersection-observer", version: "1.0.0" },
  rules: { "via-use-in-view": rule },
};

export default plugin;
