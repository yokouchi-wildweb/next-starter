// src/features/core/messaging/components/common/SendContentFields/index.tsx
// 部品(props だけ): 送るモーダルの文言の欄(送る経路ごと)。
// - その場で書く: メール = 件名・本文 / お知らせ = 題・本文
// - テンプレートを呼び出した時: 版の欄の写しを経路の欄の部品 TemplateChannelFields で直す。変数の値も入れる
// - 文言の無い経路は空欄で見せ、「文言がありません」の印(送る前に止まる)

"use client";

import { SoftBadge } from "@/components/Badge";
import { Input, Textarea } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";

import { TemplateChannelFields } from "../TemplateChannelFields";

export type SendContentFieldsProps = {
  source: "adhoc" | "template";
  /** 送る経路(カテゴリーの経路で、オンの物) */
  channels: { key: string; label: string; blank: boolean }[];
  content: Record<string, Record<string, unknown>>;
  onChange: (channel: string, fields: Record<string, unknown>) => void;
  /** テンプレートの回の変数(回に 1 組の物) */
  variables?: { key: string; label: string; type: string; required: boolean; default?: unknown }[];
  vars?: Record<string, string>;
  onVarChange?: (key: string, value: string) => void;
};

const str = (value: unknown) => (typeof value === "string" ? value : "");

export function SendContentFields({ source, channels, content, onChange, variables = [], vars = {}, onVarChange }: SendContentFieldsProps) {
  return (
    <Stack space={4} data-slot="send-content-fields">
      {channels.map((channel) => {
        const fields = content[channel.key] ?? {};
        const set = (name: string, value: string) => onChange(channel.key, { ...fields, [name]: value });
        return (
          <Stack key={channel.key} space={2}>
            <Flex align="center" gap="xs">
              <Span size="sm" weight="semiBold">
                {channel.label}
              </Span>
              {channel.blank ? (
                <SoftBadge variant="warning" size="sm">
                  文言がありません
                </SoftBadge>
              ) : null}
            </Flex>
            {source === "template" ? (
              <TemplateChannelFields channel={channel.key} value={fields} onChange={(next) => onChange(channel.key, next)} />
            ) : channel.key === "email" ? (
              <>
                <Label htmlFor="send-email-subject" className="text-sm">
                  件名
                </Label>
                <Input id="send-email-subject" value={str(fields.subject)} onChange={(e) => set("subject", e.target.value)} />
                <Label htmlFor="send-email-body" className="text-sm">
                  本文
                </Label>
                <Textarea id="send-email-body" value={str(fields.body)} rows={8} onChange={(e) => set("body", e.target.value)} />
              </>
            ) : (
              <>
                <Label htmlFor={`send-${channel.key}-title`} className="text-sm">
                  題
                </Label>
                <Input id={`send-${channel.key}-title`} value={str(fields.title)} onChange={(e) => set("title", e.target.value)} />
                <Label htmlFor={`send-${channel.key}-body`} className="text-sm">
                  本文
                </Label>
                <Textarea id={`send-${channel.key}-body`} value={str(fields.body)} rows={4} onChange={(e) => set("body", e.target.value)} />
              </>
            )}
          </Stack>
        );
      })}
      {source === "template" && variables.length > 0 ? (
        <Stack space={2}>
          <Span size="sm" weight="semiBold">
            変数の値
          </Span>
          {variables.map((variable) => (
            <Stack key={variable.key} space={1}>
              <Label htmlFor={`send-var-${variable.key}`} className="text-sm">
                {variable.label || variable.key}
                {variable.required ? "(必須)" : ""}
                <Span size="xs" tone="muted" className="ml-2 font-mono">{`{{${variable.key}}}`}</Span>
              </Label>
              <Input
                id={`send-var-${variable.key}`}
                type={variable.type === "number" ? "number" : "text"}
                value={vars[variable.key] ?? ""}
                placeholder={variable.default !== undefined ? `既定: ${String(variable.default)}` : undefined}
                onChange={(e) => onVarChange?.(variable.key, e.target.value)}
              />
            </Stack>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
