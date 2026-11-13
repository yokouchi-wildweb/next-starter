// src/features/core/messaging/services/server/templates/templateService.ts
//
// 保存されたテンプレート(管理者が画面で書く連絡の中身、D40・D41)の管理の service。/api/admin/messaging/templates が呼ぶ。
// - 状態: draft(まだ公開していない)→ published(版がある)→ archived(取り下げ。直せない)
// - 行 = 今の中身(下書き)。公開 = 今の中身を message_template_versions に版として追記し current_version を進める。
//   公開した版は書き換えない(公開済みのテンプレートを直すと行だけが変わり、次の公開で新しい版になる)
// - 版は 中身・変数・種類・経路 を持つ(回は送る時に版を固定する。送る口は指令 28)
// - 保存の検査は checks.ts(D41)、画像の結び付けは imageBinding.ts
// - 画面の選択肢 templateOptions(使える経路・種類・変数の前から使える {{鍵}})
// - service でも管理者を確かめる(D42)。監査 messaging.template.{created, updated, published, archived}

import { isDeepStrictEqual } from "node:util";

import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { MessageTemplate, MessageTemplateVersion } from "../../../entities/model";
import { assertAdminActor, type AdminCheckDeps } from "../admin/assertAdmin";
import { checkTemplateFields, templateAllowedKeys, type TemplateCheckDeps } from "./checks";
import type {
  AdminTemplateDetail,
  AdminTemplateOptions,
  AdminTemplatePage,
  AdminTemplateSummary,
  AdminTemplateVersion,
} from "./dto";
import { bindTemplateImages, type TemplateImageLedger } from "./imageBinding";
import {
  CreateMessageTemplateInputSchema,
  ListMessageTemplatesQuerySchema,
  UpdateMessageTemplateInputSchema,
} from "./schema";
import type { MessageTemplateStore } from "./types";
import { isAdminFreeTextKind } from "../admin/freeText";

export type TemplateServiceDeps<Tx> = AdminCheckDeps & {
  store: MessageTemplateStore<Tx>;
  ledger: TemplateImageLedger<Tx>;
  check: () => TemplateCheckDeps;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
};

function toSummary(row: MessageTemplate): AdminTemplateSummary {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    category: row.category,
    status: row.status,
    currentVersion: row.current_version ?? null,
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

function toVersion(row: MessageTemplateVersion): AdminTemplateVersion {
  return {
    version: row.version,
    content: row.content as Record<string, unknown>,
    variables: row.variables,
    category: row.category,
    editedBy: row.edited_by ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 行の中身が版と同じか(公開していない変更が無いか) */
function sameAsVersion(row: MessageTemplate, version: MessageTemplateVersion | null): boolean {
  if (!version) return false;
  return (
    isDeepStrictEqual(row.content, version.content) &&
    isDeepStrictEqual(row.variables, version.variables) &&
    row.category === version.category
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
  const actorId = () => deps.context()?.actorId ?? null;

  async function detailOf(row: MessageTemplate): Promise<AdminTemplateDetail> {
    const latest = await deps.store.latestVersion(row.id);
    return {
      ...toSummary(row),
      content: row.content as Record<string, unknown>,
      variables: row.variables,
      allowedKeys: templateAllowedKeys(deps.check(), row.variables),
      hasUnpublishedChanges: !sameAsVersion(row, latest),
    };
  }

  async function requireRow(id: string): Promise<MessageTemplate> {
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
    /** 一覧(新しい順、状態で絞れる) */
    async listTemplates(query: unknown = {}): Promise<AdminTemplatePage> {
      await assertAdminActor(deps);
      const { status, cursor, limit } = parseOr400(ListMessageTemplatesQuerySchema.safeParse(query), "一覧の条件が正しくありません");
      const rows = await deps.store.list({ status: status ?? null, limit, after: decodeCursor(cursor) });
      const page = rows.slice(0, limit);
      return { items: page.map(toSummary), nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null };
    },

    async getTemplate(id: string): Promise<AdminTemplateDetail> {
      await assertAdminActor(deps);
      return detailOf(await requireRow(id));
    },

    /**
     * 下書きを作る。
     * @throws DomainError(400) 入力・中身の検査 / (409) 同じ鍵がある
     */
    async createTemplate(input: unknown): Promise<AdminTemplateDetail> {
      await assertAdminActor(deps);
      const parsed = parseOr400(CreateMessageTemplateInputSchema.safeParse(input), "テンプレートの入力が正しくありません");
      const checked = checkTemplateFields(deps.check(), parsed);
      if (await deps.store.findByKey(parsed.key)) {
        throw new DomainError(`鍵 ${parsed.key} のテンプレートは既にあります`, { status: 409 });
      }
      const actor = actorId();
      const row = await deps.store.transaction(async (tx) => {
        const inserted = await deps.store.insert(tx, {
          key: parsed.key,
          name: parsed.name,
          description: parsed.description ?? null,
          category: parsed.category,
          content: checked.content,
          variables: checked.variables,
          status: "draft",
          created_by: actor,
          updated_by: actor,
        });
        const content = await bindTemplateImages(deps.ledger, tx, {
          templateId: inserted.id,
          actorUserId: actor,
          content: checked.content,
        });
        return content === checked.content ? inserted : deps.store.update(tx, inserted.id, { content });
      });
      await audit(row, "messaging.template.created");
      return detailOf(row);
    },

    /**
     * 今の中身(下書き)を直す。公開した版は変わらない。
     * @throws DomainError(400) 入力・中身の検査 / (404) 無い / (409) 取り下げ済み
     */
    async updateTemplate(id: string, input: unknown): Promise<AdminTemplateDetail> {
      await assertAdminActor(deps);
      const patch = parseOr400(UpdateMessageTemplateInputSchema.safeParse(input), "テンプレートの入力が正しくありません");
      const actor = actorId();
      const row = await deps.store.transaction(async (tx) => {
        const current = await deps.store.lockForUpdate(tx, id);
        if (!current) throw new DomainError("テンプレートがありません", { status: 404 });
        if (current.status === "archived") throw new DomainError("取り下げたテンプレートは直せません", { status: 409 });
        const checked = checkTemplateFields(deps.check(), {
          category: patch.category ?? current.category,
          content: patch.content ?? (current.content as Record<string, unknown>),
          variables: patch.variables ?? current.variables,
        });
        const content = await bindTemplateImages(deps.ledger, tx, { templateId: id, actorUserId: actor, content: checked.content });
        return deps.store.update(tx, id, {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          category: patch.category ?? current.category,
          content,
          variables: checked.variables,
          updated_by: actor,
        });
      });
      await audit(row, "messaging.template.updated");
      return detailOf(row);
    },

    /**
     * 今の中身を版として公開する(版は不変、current_version を進める)。
     * @throws DomainError(400) 中身の検査 / (404) 無い / (409) 取り下げ済み・前の版から変更が無い
     */
    async publishTemplate(id: string): Promise<AdminTemplateDetail> {
      await assertAdminActor(deps);
      const actor = actorId();
      const { row, version } = await deps.store.transaction(async (tx) => {
        const current = await deps.store.lockForUpdate(tx, id);
        if (!current) throw new DomainError("テンプレートがありません", { status: 404 });
        if (current.status === "archived") throw new DomainError("取り下げたテンプレートは公開できません", { status: 409 });
        const checked = checkTemplateFields(deps.check(), {
          category: current.category,
          content: current.content as Record<string, unknown>,
          variables: current.variables,
        });
        const latest = await deps.store.latestVersion(id, tx);
        if (sameAsVersion(current, latest)) {
          throw new DomainError(`版 ${latest!.version} から変更が無いので公開する版がありません`, { status: 409 });
        }
        const next = (latest?.version ?? 0) + 1;
        await deps.store.insertVersion(tx, {
          template_id: id,
          version: next,
          content: checked.content,
          variables: checked.variables,
          category: current.category,
          edited_by: actor,
        });
        const updated = await deps.store.update(tx, id, { status: "published", current_version: next, updated_by: actor });
        return { row: updated, version: next };
      });
      await audit(row, "messaging.template.published", { version });
      return detailOf(row);
    },

    /**
     * 取り下げる(archived。版は残る)。
     * @throws DomainError(404) 無い / (409) 取り下げ済み
     */
    async archiveTemplate(id: string): Promise<AdminTemplateDetail> {
      await assertAdminActor(deps);
      const row = await deps.store.transaction(async (tx) => {
        const current = await deps.store.lockForUpdate(tx, id);
        if (!current) throw new DomainError("テンプレートがありません", { status: 404 });
        if (current.status === "archived") throw new DomainError("既に取り下げています", { status: 409 });
        return deps.store.update(tx, id, { status: "archived", updated_by: actorId() });
      });
      await audit(row, "messaging.template.archived");
      return detailOf(row);
    },

    /** 版の一覧(新しい順) */
    async listTemplateVersions(id: string): Promise<AdminTemplateVersion[]> {
      await assertAdminActor(deps);
      await requireRow(id);
      return (await deps.store.listVersions(id)).map(toVersion);
    },

    /** 版 1 つ */
    async getTemplateVersion(id: string, version: number): Promise<AdminTemplateVersion> {
      await assertAdminActor(deps);
      if (!Number.isInteger(version) || version < 1) throw new DomainError("版の番号が正しくありません", { status: 400 });
      const row = await deps.store.findVersion(id, version);
      if (!row) throw new DomainError("その版はありません", { status: 404 });
      return toVersion(row);
    },

    /** 画面の選択肢: 使える経路・種類・変数の前から使える {{鍵}}(fork の経路・種類も受け口から入る) */
    async templateOptions(): Promise<AdminTemplateOptions> {
      await assertAdminActor(deps);
      const check = deps.check();
      return {
        channels: Object.values(check.channels)
          .filter((channel) => channel.enabled !== false)
          .map((channel) => ({ key: channel.key, label: channel.label })),
        // テンプレートに使える種類 = 管理者が送れる種別(announcement・direct・marketing)の種類だけ
        categories: Object.values(check.categories).filter((category) => isAdminFreeTextKind(category.kind)).map((category) => ({
          key: category.key,
          label: category.label,
          description: category.description ?? null,
        })),
        baseAllowedKeys: templateAllowedKeys(check, []),
      };
    },
  };
}

export type TemplateService = ReturnType<typeof createTemplateService>;
