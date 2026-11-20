// eslint-rules/raw-elements.mjs
//
// 上流(Tier1)のコードでは、包みの部品(src/components)がある HTML の要素を生で書かない(当議会 D182)。構造と文章は包みで書く。
// 止める要素 = 包みのある物だけ(下の WRAPPERS)。包みの無い要素(ul・li・dl・select・option・form・pre・code・br・strong・iframe・
// html / head / body / script 等)、飾りと演出(svg とその子・video・canvas・audio)、motion.* などの名前つきの要素、大文字の部品は止めない。
// 対象(eslint.config.mjs): src/**/*.tsx のうち src/components/**(包みそのもの)とテストを除く。強さ: 上流リポ = error、fork = off
// (fork の既存の生の要素は直させない。D182)。包みでは同じ形にできない 1 か所だけの物は、理由つきの行ごとの eslint-disable で残す(例: toast = D208)。

/** 要素 → 使う包み(止める時の案内) */
export const WRAPPERS = {
  div: "Layout/Block・Flex・Grid・Stack",
  span: "TextBlocks/Span・Layout/InBlock",
  p: "TextBlocks/Para",
  h1: "TextBlocks/PageTitle",
  h2: "TextBlocks/SecTitle",
  h3: "TextBlocks/SecTitle",
  h4: "TextBlocks/SecTitle",
  h5: "TextBlocks/SecTitle",
  h6: "TextBlocks/SecTitle",
  section: "Layout/Section",
  header: "Layout/Section(as=\"header\")",
  footer: "Layout/Section(as=\"footer\")",
  aside: "Layout/Section(as=\"aside\")",
  nav: "Layout/Section(as=\"nav\")",
  article: "Layout/Section(as=\"article\")",
  main: "Layout/Main",
  button: "Form/Button(形を自分で付けるなら variant / size none)",
  input: "Input/Input・Input/BooleanCheckboxInput 等、ファイル選択のボタンは Input/FilePickButton",
  textarea: "Input/Textarea",
  label: "Input/Label",
  img: "Media/AppImage(選んだ直後の blob: の下見は Media/PreviewImage)",
  a: "Navigation/Link",
};

const rule = {
  meta: {
    type: "problem",
    docs: { description: "包みの部品がある HTML の要素を生で書かない(上流のコードだけ)" },
    messages: {
      raw: "<{{tag}}> は生の要素です。包みの部品 {{wrapper}} で書きます(src/components/README.md。包みで同じ形にできない 1 か所だけの物は理由つきの行ごとの eslint-disable)",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier") return; // motion.div などの名前つき・名前空間つきは対象外
        const tag = node.name.name;
        const wrapper = Object.hasOwn(WRAPPERS, tag) ? WRAPPERS[tag] : undefined;
        if (wrapper) context.report({ node, messageId: "raw", data: { tag, wrapper } });
      },
    };
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-raw-elements", version: "1.0.0" },
  rules: { "no-raw-element": rule },
};

export default plugin;
