// UserPage の幅の既定が config/ui/user-layout.config の USER_PAGE_CONTAINER_TYPE に従うことの検査
// (config をモックするため UserParts.test.tsx と別ファイル。実行: pnpm test:user-layout)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { type ReactNode } from "react";

mock.module("@/config/ui/user-layout.config", { namedExports: { USER_PAGE_CONTAINER_TYPE: "narrowStack" } });

let render: (node: ReactNode) => string;
let UserPage: typeof import("./UserPage").UserPage;
let Main: typeof import("@/components/Layout/Main").Main;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ UserPage } = await import("./UserPage"));
  ({ Main } = await import("@/components/Layout/Main"));
});

test("containerType を渡さない UserPage は config の USER_PAGE_CONTAINER_TYPE の幅で描く", () => {
  assert.equal(render(<UserPage>CHILD</UserPage>), render(<Main containerType="narrowStack">CHILD</Main>));
});

test("containerType の明示は config の既定より勝ち、fill は既定を使わない", () => {
  assert.equal(render(<UserPage containerType="wideShowcase">CHILD</UserPage>), render(<Main containerType="wideShowcase">CHILD</Main>));
  assert.equal(render(<UserPage fill>CHILD</UserPage>).includes("narrow-stack"), false);
});
