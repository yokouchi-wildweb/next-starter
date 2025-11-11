import type { SearchParams } from "@/lib/crud";

// バリデーション失敗を表す API 層専用のエラー
class BadRequestError extends Error {}

// クエリパラメータから正の整数を解析するヘルパー
export function parsePositiveInteger(value: string | null, label: string) {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${label} は正の整数で指定してください`);
  }
  return parsed;
}

// orderBy クエリを配列形式に正規化するヘルパー
export function parseOrderBy(values: string[]): SearchParams["orderBy"] {
  if (values.length === 0) return undefined;
  if (values.length === 1) {
    const single = values[0]?.trim();
    if (!single) return undefined;
    if (single.startsWith("[")) {
      try {
        const parsed = JSON.parse(single);
        if (!Array.isArray(parsed)) {
          throw new BadRequestError("orderBy は [[field,\"ASC\"]] の配列形式で指定してください");
        }
        return parsed as SearchParams["orderBy"];
      } catch (error) {
        if (error instanceof BadRequestError) throw error;
        throw new BadRequestError("orderBy は JSON 形式か \"field:direction\" 形式で指定してください");
      }
    }
  }

  const entries: NonNullable<SearchParams["orderBy"]> = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    let field: string | undefined;
    let direction: string | undefined;
    const candidates = [":", ","] as const;

    for (const separator of candidates) {
      const parts = trimmed.split(separator);
      if (parts.length === 2) {
        [field, direction] = parts.map((part) => part.trim());
        break;
      }
    }

    if (!field || !direction) {
      throw new BadRequestError("orderBy は \"field:direction\" 形式で指定してください");
    }

    const normalizedDirection = direction.toUpperCase();
    if (normalizedDirection !== "ASC" && normalizedDirection !== "DESC") {
      throw new BadRequestError("orderBy の direction は ASC もしくは DESC を指定してください");
    }

    entries.push([field, normalizedDirection]);
  }

  return entries.length ? entries : undefined;
}

// searchFields クエリを配列へ整形するヘルパー
function parseStringList(values: string[]): string[] | undefined {
  if (values.length === 0) return undefined;
  const fields = values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return fields.length ? fields : undefined;
}

export function parseSearchFields(values: string[]): string[] | undefined {
  return parseStringList(values);
}

export function parseSearchPriorityFields(values: string[]): string[] | undefined {
  return parseStringList(values);
}

export function parseBooleanFlag(value: string | null, label: string): boolean | undefined {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "") return undefined;
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new BadRequestError(`${label} は true / false もしくは 1 / 0 で指定してください`);
}

// where クエリを JSON として読み込むヘルパー
export function parseWhere(value: string | null): SearchParams["where"] {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as SearchParams["where"];
  } catch {
    throw new BadRequestError("where は有効な JSON 文字列で指定してください");
  }
}

export { BadRequestError };
