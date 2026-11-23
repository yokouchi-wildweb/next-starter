// 生成された作成・編集フォーム(ひな形 src/domains/_template/components/common/{Create,Edit}__Domain__Form.tsx の出力)が
// AppForm の約束(onSubmit の reject = 失敗、src/lib/formSuite/README.md・unsavedGuard)を守ることの検査。
// - 保存の失敗: エラーのトーストを出し、移動せず、onSubmitAction は reject する(AppForm が未保存の守りを戻す)
// - 保存の成功: 成功のトーストを出して移動し、resolve する
// AppForm 側(reject を受けて守りを戻す・外へ漏らさない)は src/lib/formSuite/submitFailure.render.test.tsx が見る。
// ここでは useAutoSave の無い生成ドメイン sampleTag のフォームで、ひな形の submit の形だけを見る。
// 実行: pnpm test src/domains/sampleTag/components/common/SampleTagForms.render.test.tsx
// (tsx + node:test のモジュールモック + react-dom/server の静的描画。package.json に type: module が無いので
//  tsx は CJS として読む = top-level await・import.meta 不可 → before() で import、__dirname で解決)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement } from "react";

const here = (path: string) => pathToFileURL(join(__dirname, path)).href;

type SubmitAction = (data: Record<string, unknown>) => Promise<void>;

const state = {
  /** 描いたフォームが SampleTagForm に渡した onSubmitAction */
  submit: undefined as SubmitAction | undefined,
  /** trigger の結果: 失敗させるなら Error */
  failure: undefined as Error | undefined,
  toasts: [] as { message: unknown; kind: string }[],
  pushes: [] as string[],
};

const trigger = async () => {
  if (state.failure) throw state.failure;
  return {};
};

// フォームの見た目(AppForm・欄)は描かない: 受け取った onSubmitAction を拾うだけ
mock.module(here("./SampleTagForm.tsx"), {
  namedExports: {
    SampleTagForm: ({ onSubmitAction }: { onSubmitAction: SubmitAction }) => {
      state.submit = onSubmitAction;
      return null;
    },
  },
});
mock.module("@/domains/sampleTag/hooks/useUpdateSampleTag", {
  namedExports: { useUpdateSampleTag: () => ({ trigger, isMutating: false }) },
});
mock.module("@/domains/sampleTag/hooks/useCreateSampleTag", {
  namedExports: { useCreateSampleTag: () => ({ trigger, isMutating: false }) },
});
mock.module("@/lib/unsavedGuard", {
  namedExports: { useRouter: () => ({ push: (href: string) => void state.pushes.push(href) }) },
});
mock.module("@/lib/toast", {
  namedExports: {
    useToast: () => ({ showToast: (message: unknown, kind: string) => void state.toasts.push({ message, kind }) }),
    useLoadingToast: () => {},
  },
});

let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
let EditSampleTagForm: typeof import("./EditSampleTagForm").default;
let CreateSampleTagForm: typeof import("./CreateSampleTagForm").default;
before(async () => {
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  EditSampleTagForm = (await import("./EditSampleTagForm")).default;
  CreateSampleTagForm = (await import("./CreateSampleTagForm")).default;
});

beforeEach(() => {
  state.submit = undefined;
  state.failure = undefined;
  state.toasts = [];
  state.pushes = [];
});

const forms = [
  {
    name: "編集",
    render: () =>
      renderToStaticMarkup(
        createElement(EditSampleTagForm, {
          sampleTag: { id: "tag-1" } as Parameters<typeof EditSampleTagForm>[0]["sampleTag"],
          redirectPath: "/admin/sample-tags",
        }),
      ),
  },
  {
    name: "作成",
    render: () => renderToStaticMarkup(createElement(CreateSampleTagForm, { redirectPath: "/admin/sample-tags" })),
  },
];

for (const form of forms) {
  test(`${form.name}フォーム: 保存の失敗はトーストを出し、移動せず、reject する(守りを AppForm に戻させる)`, async () => {
    form.render();
    assert.ok(state.submit, "onSubmitAction を渡している");
    const failure = new Error("Network Error");
    state.failure = failure;

    await assert.rejects(state.submit({}), (error) => error === failure, "失敗をそのまま投げ直す");
    assert.equal(state.toasts.length, 1);
    assert.equal(state.toasts[0].kind, "error", "エラーのトーストはフォームが出す");
    assert.deepEqual(state.pushes, [], "失敗では移動しない");
  });

  test(`${form.name}フォーム: 保存の成功はトーストを出して移動し、resolve する`, async () => {
    form.render();
    assert.ok(state.submit);

    await state.submit({});
    assert.equal(state.toasts.length, 1);
    assert.equal(state.toasts[0].kind, "success");
    assert.deepEqual(state.pushes, ["/admin/sample-tags"]);
  });
}
