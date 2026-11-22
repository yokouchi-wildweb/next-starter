// src/features/core/messaging/services/server/templates/templateService.ts
//
// 保存されたテンプレート(管理者が画面で書く連絡の中身、D40・D41)の管理の service。/api/admin/messaging/templates が呼ぶ。
// - 状態は持たない: 下書きは無く(D134: 保存 = 公開)、要らなくなれば消す(D137: 版も消え、送信は残り template_id が null)
// - 作る = 行と版 1 を 1 つの取引で書く。直す = 行を書き、中身が最新の版と違えば同じ取引で版を追記して current_version を進める
//   (同じ中身なら版を作らず unchanged。名前・説明だけの変更も版を作らない)。版は書き換えない
// - 中身 = カテゴリー + レイアウト + 欄の中身 + 専用の埋め込み情報の宣言(指令 58)。版は保存の時の レイアウト・レイアウトの版・欄の中身・宣言・カテゴリーを持つ
//   (送信は送る時に版を固定する)。レイアウトを替える時は入力の欄の中身だけを持つ(前のレイアウトの中身は残さない、D113)
// - 保存の検査は checks.ts(D41)、画像の結び付けは imageBinding.ts
// - 画面の選択肢 templateOptions(使える送信チャンネル・カテゴリー・管理者が選べるレイアウト・専用の宣言の前から書ける埋め込み情報)
// - 消す時: 欄の中身を残している送信が使う画像を、同じ取引で送信に結び直す(テンプレートの行が消えると storage の照合が外すため)
// - service でも管理者を確かめる(D42)。監査 messaging.template.{created, updated, deleted}(created・updated は版の番号、deleted は名前と最後の版)
// - 一覧は種別(kind)で絞れる: その種別のカテゴリーのテンプレート(D135)。テンプレートは DB の物だけ(システムテンプレートは廃止、D171)

import { randomBytes } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import type { AuditRecordInput } from "@/lib/audit";
import { buildChannelContent, categoryAdminLabel, isLayoutAdminSelectable, isLayoutUsable, layoutVersionOf, upgradeLayoutValues, type MessageVarDeclaration, type MessageVarEntry } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import type { MessageTemplate, MessageTemplateVersion } from "../../../entities/model";
import { assertAdminActor, type AdminCheckDeps } from "../admin/assertAdmin";
import { adminSelectableLayouts, checkTemplateFields, templateVarCatalog, type TemplateCheckDeps } from "./checks";
import type {
  AdminLayoutPreview,
  AdminVarEntry,
  AdminTemplateDetail,
  AdminTemplateOptions,
  AdminTemplatePage,
  AdminTemplateSaveResult,
  AdminTemplateSummary,
  AdminTemplateVersion,
} from "./dto";
import { bindInboxImages, inboxItemImageRefs, withBoundInboxImages, type InboxImageLedger } from "../inbox/imageBinding";
import { bindTemplateImages, type TemplateImageLedger } from "./imageBinding";
import {
  CreateMessageTemplateInputSchema,
  ListMessageTemplatesQuerySchema,
  PreviewMessageLayoutInputSchema,
  UpdateMessageTemplateInputSchema,
} from "./schema";
import type { MessageTemplateStore } from "./types";
import { isAdminSendableKind } from "../sendMessage/templateDefinition";

export type TemplateServiceDeps<Tx> = AdminCheckDeps & {
  store: MessageTemplateStore<Tx>;
  ledger: TemplateImageLedger<Tx>;
  /** 送信の画像の台帳(消す時に、残す送信の画像を送信へ結び直す。受け取り箱と同じ持ち主 messaging.dispatch) */
  dispatchLedger: InboxImageLedger<Tx>;
  check: () => TemplateCheckDeps;
  /** 作る画面の最初のレイアウト(config の messaging.initialLayout) */
  initialLayout: () => string;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
  /** 送信チャンネルの鍵 → レイアウトの描き方を持つレイアウトの鍵の表(email = layoutEmails。プレビューが 3 段の 1 段目を選ぶのに使う) */
  layoutRenderers?: () => Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** 送信チャンネルのプレビュー(送信チャンネルの受け口の preview。無い送信チャンネルは html なし) */
  channelPreview?: (
    channel: string,
    input: { messageKey: string; content: unknown; category?: string },
  ) => Promise<{ html?: string; text?: string }> | null;
};

/** プレビューで送信チャンネルへ渡す連絡の鍵(テンプレートの送信と同じ。停止のリンクの見本に使うだけ) */
const PREVIEW_MESSAGE_KEY = "messaging.template";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** テンプレートの id は uuid(形の違う id は「無い」= 404。DB に uuid でない値を渡さない) */
function assertTemplateId(id: string): void {
  if (!UUID.test(id)) throw new DomainError("テンプレートがありません", { status: 404 });
}

/** カテゴリーの表示名(受け口の label。無ければ null) */
type CategoryLabelOf = (category: string) => string | null;

/** 作るテンプレートの鍵(運営する人は打たない、D46)。tpl- + 英小文字・数字 10 字 */
export function newTemplateKey(): string {
  const bytes = randomBytes(10);
  return `tpl-${Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("")}`;
}

function toEntry(entry: MessageVarEntry): AdminVarEntry {
  return { key: entry.key, alias: entry.alias, source: entry.source, description: entry.description ?? null };
}

/** テンプレートのレイアウトが使えるか(受け口にあり disabled でない) */
type LayoutUsableOf = (layout: string) => boolean;

function toSummary(row: MessageTemplate, categoryLabel: CategoryLabelOf, layoutUsable: LayoutUsableOf): AdminTemplateSummary {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    category: row.category,
    categoryLabel: categoryLabel(row.category),
    currentVersion: row.current_version ?? null,
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    layout: row.layout,
    values: row.values,
    usable: layoutUsable(row.layout),
  };
}

function toVersion(row: MessageTemplateVersion, categoryLabel: CategoryLabelOf): AdminTemplateVersion {
  return {
    version: row.version,
    layout: row.layout,
    layoutVersion: row.layout_version,
    values: row.values,
    vars: row.vars,
    category: row.category,
    categoryLabel: categoryLabel(row.category),
    editedBy: row.edited_by ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 版にする中身 */
type TemplateContent = Pick<MessageTemplate, "category" | "layout" | "layout_version" | "values" | "vars">;

/** 中身が版と同じか(同じなら新しい版を作らない) */
function sameAsVersion(content: TemplateContent, version: MessageTemplateVersion | null): boolean {
  if (!version) return false;
  return (
    content.layout === version.layout &&
    content.layout_version === version.layout_version &&
    isDeepStrictEqual(content.values, version.values) &&
    isDeepStrictEqual(content.vars, version.vars) &&
    content.category === version.category
  );
}

function encodeCursor(row: MessageTemplate): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const createdAt = new Date(iso ?? "");
  if (!id || Number.isNaN(createdAt.getTime())) throw new DomainError("cursor が正しくありません", { status: 400 });
  return { createdAt, id };
}

function parseOr400<T>(result: { success: true; data: T } | { success: false }, message: string): T {
  if (!result.success) throw new DomainError(message, { status: 400 });
  return result.data;
}

export function createTemplateService<Tx>(deps: TemplateServiceDeps<Tx>) {
  const categoryLabel: CategoryLabelOf = (category) => { const found = deps.check().categories[category]; return found ? categoryAdminLabel(found) : null; };
  const layoutUsable: LayoutUsableOf = (key) => { const found = deps.check().layouts[key]; return Boolean(found && isLayoutUsable(found)); };
  const actorId = () => deps.context()?.actorId ?? null;

  const catalogOf = (own: readonly MessageVarDeclaration[]) => templateVarCatalog(deps.check(), own).map(toEntry);

  function detailOf(row: MessageTemplate): AdminTemplateDetail {
    return {
      ...toSummary(row, categoryLabel, layoutUsable),
      layoutVersion: row.layout_version,
      vars: row.vars,
      catalog: catalogOf(row.vars),
    };
  }

  /** 中身を版として追記する(取引の中。版の番号を返す) */
  async function appendVersion(tx: Tx, templateId: string, content: TemplateContent, version: number, actor: string | null) {
    await deps.store.insertVersion(tx, {
      template_id: templateId,
      version,
      layout: content.layout,
      layout_version: content.layout_version,
      values: content.values,
      vars: content.vars,
      category: content.category,
      edited_by: actor,
    });
  }

  /**
   * 行の欄の中身を今のレイアウトの版へ読み替える(レイアウトが改版していれば revisions を当てる)。読めなければ 409
   */
  function currentValues(row: MessageTemplate): Record<string, unknown> {
    const layout = deps.check().layouts[row.layout];
    if (!layout) return row.values;
    const upgraded = upgradeLayoutValues(layout, row.values, row.layout_version);
    if ("cannotRender" in upgraded) throw new DomainError(upgraded.cannotRender, { status: 409 });
    return upgraded.values;
  }

  async function requireRow(id: string): Promise<MessageTemplate> {
    assertTemplateId(id);
    const row = await deps.store.find(id);
    if (!row) throw new DomainError("テンプレートがありません", { status: 404 });
    return row;
  }

  async function audit(row: MessageTemplate, action: string, metadata: Record<string, unknown> = {}) {
    await deps.recordAudit({
      targetType: "message_template",
      targetId: row.id,
      action,
      metadata: { key: row.key, ...metadata },
    });
  }

  return {
    /** 一覧(新しい順、種別で絞れる。種別 = その種別のカテゴリーのテンプレート、D135) */
    async listTemplates(query: unknown = {}): Promise<AdminTemplatePage> {
      await assertAdminActor(deps);
      const { kind, cursor, limit } = parseOr400(ListMessageTemplatesQuerySchema.safeParse(query), "一覧の条件が正しくありません");
      const categories = kind
        ? Object.values(deps.check().categories)
            .filter((category) => category.kind === kind)
            .map((category) => category.key)
        : null;
      const rows = await deps.store.list({ categories, limit, after: decodeCursor(cursor) });
      const page = rows.slice(0, limit);
      return {
        items: page.map((row) => toSummary(row, categoryLabel, layoutUsable)),
        nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
      };
    },

    async getTemplate(id: string): Promise<AdminTemplateDetail> {
      await assertAdminActor(deps);
      return detailOf(await requireRow(id));
    },

    /**
     * 作る = 行と版 1 を 1 つの取引で書く(保存 = 公開、D134)。
     * 鍵はサーバーが作る(入力に key は無い。送ると 400)。
     * @throws DomainError(400) 入力・中身の検査
     */
    async createTemplate(input: unknown): Promise<AdminTemplateDetail> {
      await assertAdminActor(deps);
      const parsed = parseOr400(CreateMessageTemplateInputSchema.safeParse(input), "テンプレートの入力が正しくありません");
      const checked = checkTemplateFields(deps.check(), parsed);
      // 鍵はサーバーが作る(運営する人は打たない、D46)。重なれば作り直す(10 字の 36 進なので実際にはまず重ならない)
      let key = newTemplateKey();
      for (let attempt = 0; (await deps.store.findByKey(key)) && attempt < 5; attempt += 1) key = newTemplateKey();
      const actor = actorId();
      const row = await deps.store.transaction(async (tx) => {
        const inserted = await deps.store.insert(tx, {
          key,
          name: parsed.name,
          description: parsed.description ?? null,
          category: parsed.category,
          layout: checked.layout,
          layout_version: checked.layoutVersion,
          values: checked.values,
          vars: checked.vars,
          current_version: 1,
          created_by: actor,
          updated_by: actor,
        });
        const values = await bindTemplateImages(deps.ledger, tx, {
          templateId: inserted.id,
          actorUserId: actor,
          values: checked.values,
        });
        const saved = values === checked.values ? inserted : await deps.store.update(tx, inserted.id, { values });
        await appendVersion(tx, saved.id, saved, 1, actor);
        return saved;
      });
      await audit(row, "messaging.template.created", { version: 1 });
      return detailOf(row);
    },

    /**
     * 直す = 行を書き、中身が最新の版と違えば同じ取引で新しい版にする(保存 = 公開、D134)。
     * 名前・説明はいつも保存する。中身が版と同じなら版を作らず unchanged: true(409 にしない)
     * @throws DomainError(400) 入力・中身の検査 / (404) 無い
     */
    async updateTemplate(id: string, input: unknown): Promise<AdminTemplateSaveResult> {
      await assertAdminActor(deps);
      assertTemplateId(id);
      const patch = parseOr400(UpdateMessageTemplateInputSchema.safeParse(input), "テンプレートの入力が正しくありません");
      const actor = actorId();
      const { row, version } = await deps.store.transaction(async (tx) => {
        const current = await deps.store.lockForUpdate(tx, id);
        if (!current) throw new DomainError("テンプレートがありません", { status: 404 });
        // レイアウトを替える時は入力の欄の中身だけ(前のレイアウトの中身は持ち越さない、D113)。同じレイアウトなら入力が無ければ今の中身
        const layoutChanged = patch.layout !== undefined && patch.layout !== current.layout;
        if (layoutChanged && patch.values === undefined) {
          throw new DomainError("レイアウトを替える時は新しいレイアウトの欄の中身も送ってください", { status: 400 });
        }
        const category = patch.category ?? current.category;
        const checked = checkTemplateFields(deps.check(), {
          category,
          layout: patch.layout ?? current.layout,
          values: patch.values ?? currentValues(current),
          vars: patch.vars ?? current.vars,
        });
        const values = await bindTemplateImages(deps.ledger, tx, { templateId: id, actorUserId: actor, values: checked.values });
        const content: TemplateContent = {
          category,
          layout: checked.layout,
          layout_version: checked.layoutVersion,
          values,
          vars: checked.vars,
        };
        const latest = await deps.store.latestVersion(id, tx);
        const next = sameAsVersion(content, latest) ? null : (latest?.version ?? 0) + 1;
        if (next !== null) await appendVersion(tx, id, content, next, actor);
        const updated = await deps.store.update(tx, id, {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...content,
          ...(next !== null ? { current_version: next } : {}),
          updated_by: actor,
        });
        return { row: updated, version: next };
      });
      await audit(row, "messaging.template.updated", { version: version ?? row.current_version ?? null, newVersion: version !== null });
      return { ...detailOf(row), unchanged: version === null };
    },

    /**
     * 消す(D137): 版は消え(FK cascade)、送信は残る(template_id は FK で null、版の番号・中身は送信に残る)。
     * 欄の中身を残している送信(予約・送り直し・同じ内容で送る)が使う画像は、同じ取引で送信に結び直す(複製を送信の持ち物にし、中身の参照を書き換える)。
     * @throws DomainError(404) 無い / (409) システムテンプレート
     */
    async deleteTemplate(id: string): Promise<{ id: string; deleted: true }> {
      await assertAdminActor(deps);
      assertTemplateId(id);
      const row = await deps.store.transaction(async (tx) => {
        const current = await deps.store.lockForUpdate(tx, id);
        if (!current) throw new DomainError("テンプレートがありません", { status: 404 });
        for (const dispatch of await deps.store.lockKeptDispatches(tx, id)) {
          const refs = inboxItemImageRefs({ values: dispatch.values });
          if (refs.length === 0) continue;
          const { map, metadata } = await bindInboxImages(deps.dispatchLedger, tx, dispatch, refs);
          const rewritten = withBoundInboxImages({ values: dispatch.values }, map).values ?? dispatch.values;
          if (metadata || !isDeepStrictEqual(rewritten, dispatch.values)) {
            await deps.store.updateDispatchImages(tx, dispatch.id, { values: rewritten, metadata: metadata ?? dispatch.metadata ?? {} });
          }
        }
        await deps.store.remove(tx, id);
        return current;
      });
      await audit(row, "messaging.template.deleted", { name: row.name, lastVersion: row.current_version ?? null });
      return { id: row.id, deleted: true };
    },

    /** 版の一覧(新しい順) */
    async listTemplateVersions(id: string): Promise<AdminTemplateVersion[]> {
      await assertAdminActor(deps);
      await requireRow(id);
      return (await deps.store.listVersions(id)).map((row) => toVersion(row, categoryLabel));
    },

    /** 版 1 つ */
    async getTemplateVersion(id: string, version: number): Promise<AdminTemplateVersion> {
      await assertAdminActor(deps);
      if (!Number.isInteger(version) || version < 1) throw new DomainError("版の番号が正しくありません", { status: 400 });
      assertTemplateId(id);
      const row = await deps.store.findVersion(id, version);
      if (!row) throw new DomainError("その版はありません", { status: 404 });
      return toVersion(row, categoryLabel);
    },

    /** 画面の選択肢: 使える送信チャンネル・カテゴリー・管理者が選べるレイアウト・専用の宣言の前から書ける埋め込み情報(fork の物も受け口から入る) */
    async templateOptions(): Promise<AdminTemplateOptions> {
      await assertAdminActor(deps);
      const check = deps.check();
      return {
        channels: Object.values(check.channels)
          .filter((channel) => channel.enabled !== false)
          .map((channel) => ({ key: channel.key, label: channel.label })),
        // テンプレートに使えるカテゴリー = 管理者が送れる種別(announcement・direct・promotion)のカテゴリーだけ
        categories: Object.values(check.categories).filter((category) => isAdminSendableKind(category.kind)).map((category) => ({
          key: category.key,
          label: categoryAdminLabel(category),
          description: category.description ?? null,
          kind: category.kind,
          // そのカテゴリーで送る送信チャンネル(受け口にあり使える物だけ。プレビューのタブと送信チャンネルだけの欄はこの分、D115)
          channels: category.channels.filter((key) => check.channels[key] && check.channels[key].enabled !== false),
        })),
        layouts: adminSelectableLayouts(check).map((layout) => ({
          key: layout.key,
          label: layout.label,
          description: layout.description ?? null,
          version: layoutVersionOf(layout),
          fields: layout.fields,
        })),
        initialLayout: deps.initialLayout(),
        baseCatalog: catalogOf([]),
      };
    },

    /**
     * レイアウトのプレビュー(作る・直す・送る画面、D114): 管理者が選べるレイアウトと欄の中身(保存しない)を送信チャンネル 1 つで描く。
     * 描き方は送る口と同じ 3 段(buildChannelContent)、メールは送信チャンネルの preview が送る HTML を返す。{{名前}} は差し込まずそのまま見せる。
     * 描けない(3 段のどれでも描けない)時は cannotRender に理由。保存しない・送信を作らない
     */
    async previewLayout(input: unknown): Promise<AdminLayoutPreview> {
      await assertAdminActor(deps);
      const parsed = PreviewMessageLayoutInputSchema.safeParse(input);
      if (!parsed.success) throw new DomainError("プレビューの入力が正しくありません", { status: 400 });
      const { layout: layoutKey, channel: channelKey, values, category } = parsed.data;
      const check = deps.check();
      const layout = check.layouts[layoutKey];
      if (!layout || !isLayoutAdminSelectable(layout)) throw new DomainError("選べないレイアウトです", { status: 400 });
      const channel = check.channels[channelKey];
      if (!channel || channel.enabled === false) throw new DomainError("使えない送信方法です", { status: 400 });
      if (category && !check.categories[category]) throw new DomainError("知らないカテゴリーです", { status: 400 });
      const built = await buildChannelContent({
        layout,
        channelKey,
        channel,
        hasLayoutRenderer: Boolean(deps.layoutRenderers?.()[channelKey]?.[layout.key]),
        values,
      });
      if ("cannotRender" in built) {
        return { channel: channelKey, html: null, text: null, title: null, summary: null, cannotRender: built.cannotRender };
      }
      let summary: AdminLayoutPreview["summary"] = null;
      try {
        summary = layout.summary(values);
      } catch {
        summary = null;
      }
      const rendered = await deps.channelPreview?.(channelKey, {
        messageKey: PREVIEW_MESSAGE_KEY,
        content: built.content,
        ...(category ? { category } : {}),
      });
      return {
        channel: channelKey,
        html: rendered?.html ?? null,
        text: rendered?.text ?? null,
        title: built.title,
        summary,
        cannotRender: null,
      };
    },
  };
}

export type TemplateService = ReturnType<typeof createTemplateService>;
