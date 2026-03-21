// scripts/firestore/cli.ts
// Firestore CLIツール - コレクション一覧、ドキュメント数、構造確認、クエリ実行

import { config } from "dotenv";

// .env.development を読み込む
config({ path: ".env.development" });

import { cert, getApps, initializeApp } from "firebase-admin/app";
import type { AppOptions } from "firebase-admin/app";
import {
  getFirestore,
  type CollectionReference,
  type Query,
} from "firebase-admin/firestore";

// --- Firebase Admin 初期化 ---

const ADMIN_APP_NAME = "cli";

function initFirestore() {
  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) return getFirestore(existing);

  const serviceAccountKey = process.env.MY_SERVICE_ACCOUNT_KEY?.trim();
  if (!serviceAccountKey) {
    console.error(
      "エラー: 環境変数 MY_SERVICE_ACCOUNT_KEY が設定されていません",
    );
    process.exit(1);
  }

  const options: AppOptions = {
    credential: cert(JSON.parse(serviceAccountKey)),
  };
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    options.projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  }

  const app = initializeApp(options, ADMIN_APP_NAME);
  return getFirestore(app);
}

// --- 表示ユーティリティ ---

function printTable(rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    console.log("(0 件)");
    return;
  }

  const columns = Object.keys(rows[0]);
  const widths: Record<string, number> = {};

  for (const col of columns) {
    widths[col] = col.length;
    for (const row of rows) {
      const val = String(row[col] ?? "NULL");
      widths[col] = Math.max(widths[col], val.length);
    }
    widths[col] = Math.min(widths[col], 60);
  }

  const header = columns.map((col) => col.padEnd(widths[col])).join(" | ");
  const separator = columns
    .map((col) => "-".repeat(widths[col]))
    .join("-+-");

  console.log(header);
  console.log(separator);

  for (const row of rows) {
    const line = columns
      .map((col) => {
        let val = String(row[col] ?? "NULL");
        if (val.length > 60) val = val.slice(0, 57) + "...";
        return val.padEnd(widths[col]);
      })
      .join(" | ");
    console.log(line);
  }

  console.log(`\n(${rows.length} 件)`);
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object" && val !== null) {
    // Firestore Timestamp
    if ("toDate" in val && typeof (val as Record<string, unknown>).toDate === "function") {
      return (val as { toDate: () => Date }).toDate().toISOString();
    }
    // GeoPoint
    if ("latitude" in val && "longitude" in val) {
      return `GeoPoint(${(val as { latitude: number }).latitude}, ${(val as { longitude: number }).longitude})`;
    }
    // DocumentReference
    if ("path" in val && "id" in val) {
      return `Ref(${(val as { path: string }).path})`;
    }
    return JSON.stringify(val);
  }
  return String(val);
}

function detectType(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "string") return "string";
  if (typeof val === "number") return "number";
  if (typeof val === "boolean") return "boolean";
  if (val instanceof Date) return "timestamp";
  if (typeof val === "object" && val !== null) {
    if ("toDate" in val && typeof (val as Record<string, unknown>).toDate === "function") return "timestamp";
    if ("latitude" in val && "longitude" in val) return "geopoint";
    if ("path" in val && "id" in val) return "reference";
    if (Array.isArray(val)) return "array";
    return "map";
  }
  return typeof val;
}

// --- コマンド実装 ---

type Command = "collections" | "count" | "describe" | "query";

async function listCollections(path?: string) {
  const db = initFirestore();

  let collections: CollectionReference[];
  if (path) {
    // サブコレクション一覧
    const docRef = db.doc(path);
    collections = await docRef.listCollections();
    console.log(`\n📁 サブコレクション: ${path}\n`);
  } else {
    // ルートコレクション一覧
    collections = await db.listCollections();
    console.log("\n📁 ルートコレクション\n");
  }

  if (collections.length === 0) {
    console.log("コレクションが見つかりません");
    return;
  }

  const rows: Record<string, unknown>[] = [];
  for (const col of collections) {
    // ドキュメント数を取得
    const snapshot = await col.count().get();
    rows.push({
      collection: col.id,
      path: col.path,
      count: snapshot.data().count,
    });
  }

  printTable(rows);
}

async function countDocuments(collectionPath?: string) {
  const db = initFirestore();

  if (collectionPath) {
    const snapshot = await db.collection(collectionPath).count().get();
    console.log(`${collectionPath}: ${snapshot.data().count} docs`);
  } else {
    // 全ルートコレクションのカウント
    const collections = await db.listCollections();
    for (const col of collections) {
      const snapshot = await col.count().get();
      console.log(`${col.id}: ${snapshot.data().count} docs`);
    }
  }
}

async function describeCollection(collectionPath: string) {
  const db = initFirestore();
  const snapshot = await db.collection(collectionPath).limit(10).get();

  if (snapshot.empty) {
    console.log(`\nコレクション "${collectionPath}" にドキュメントがありません`);
    return;
  }

  console.log(
    `\n📋 コレクション: ${collectionPath} (${snapshot.size} 件のサンプルから推測)\n`,
  );

  // 全サンプルドキュメントからフィールドと型を収集
  const fieldInfo: Record<string, Set<string>> = {};
  let sampleCount = 0;

  for (const doc of snapshot.docs) {
    sampleCount++;
    const data = doc.data();
    for (const [key, value] of Object.entries(data)) {
      if (!fieldInfo[key]) fieldInfo[key] = new Set();
      fieldInfo[key].add(detectType(value));
    }
  }

  console.log("--- フィールド ---");
  const rows = Object.entries(fieldInfo)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([field, types]) => ({
      field,
      type: Array.from(types).join(" | "),
      found_in: `${sampleCount}/${snapshot.size} docs`,
    }));
  printTable(rows);

  // サブコレクション確認（最初のドキュメントのみ）
  const firstDoc = snapshot.docs[0];
  const subCollections = await firstDoc.ref.listCollections();
  if (subCollections.length > 0) {
    console.log("\n--- サブコレクション ---");
    const subRows = subCollections.map((col) => ({
      collection: col.id,
      path: col.path,
    }));
    printTable(subRows);
  }
}

function parseOperator(op: string): FirebaseFirestore.WhereFilterOp {
  const mapping: Record<string, FirebaseFirestore.WhereFilterOp> = {
    "==": "==",
    "!=": "!=",
    "<": "<",
    "<=": "<=",
    ">": ">",
    ">=": ">=",
    in: "in",
    "not-in": "not-in",
    "array-contains": "array-contains",
  };
  const result = mapping[op];
  if (!result) {
    console.error(
      `不正な演算子: "${op}"\n有効な演算子: ${Object.keys(mapping).join(", ")}`,
    );
    process.exit(1);
  }
  return result;
}

function parseValue(val: string): unknown {
  // boolean
  if (val === "true") return true;
  if (val === "false") return false;
  if (val === "null") return null;
  // number
  const num = Number(val);
  if (!isNaN(num) && val.trim() !== "") return num;
  // array (for in / not-in)
  if (val.startsWith("[") && val.endsWith("]")) {
    try {
      return JSON.parse(val);
    } catch {
      // パース失敗時は文字列として扱う
    }
  }
  return val;
}

async function queryCollection(
  collectionPath: string,
  whereArgs: string[],
  limit: number,
) {
  const db = initFirestore();
  let query: Query = db.collection(collectionPath);

  // where条件をパース（3つずつ: field operator value）
  if (whereArgs.length > 0) {
    if (whereArgs.length % 3 !== 0) {
      console.error(
        "where条件は「フィールド 演算子 値」の3つ組で指定してください",
      );
      process.exit(1);
    }
    for (let i = 0; i < whereArgs.length; i += 3) {
      const field = whereArgs[i];
      const op = parseOperator(whereArgs[i + 1]);
      const value = parseValue(whereArgs[i + 2]);
      query = query.where(field, op, value);
    }
  }

  const snapshot = await query.limit(limit).get();

  if (snapshot.empty) {
    console.log("(0 件)");
    return;
  }

  // 全ドキュメントからフィールドを収集して表示
  const allFields = new Set<string>();
  allFields.add("_id");
  for (const doc of snapshot.docs) {
    for (const key of Object.keys(doc.data())) {
      allFields.add(key);
    }
  }

  const rows = snapshot.docs.map((doc) => {
    const row: Record<string, unknown> = { _id: doc.id };
    const data = doc.data();
    for (const field of allFields) {
      if (field === "_id") continue;
      row[field] = formatValue(data[field]);
    }
    return row;
  });

  printTable(rows);
}

// --- メイン ---

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] as Command;
  const param = args[1];

  switch (command) {
    case "collections":
      await listCollections(param || undefined);
      break;

    case "count":
      await countDocuments(param || undefined);
      break;

    case "describe":
      if (!param) {
        console.error("使用法: pnpm fs:describe <collection_path>");
        process.exit(1);
      }
      await describeCollection(param);
      break;

    case "query": {
      if (!param) {
        console.error(
          '使用法: pnpm fs:query <collection_path> [field op value ...]',
        );
        process.exit(1);
      }
      // --limit オプション
      const limitIdx = args.indexOf("--limit");
      let limit = 20;
      let whereArgs = args.slice(2);
      if (limitIdx !== -1) {
        limit = parseInt(args[limitIdx + 1], 10) || 20;
        whereArgs = [
          ...args.slice(2, limitIdx),
          ...args.slice(limitIdx + 2),
        ];
      }
      await queryCollection(param, whereArgs, limit);
      break;
    }

    default:
      console.log(`
Firestore CLIツール

使用法:
  pnpm fs:collections [doc_path]       コレクション一覧（サブコレクション対応）
  pnpm fs:count [collection_path]      ドキュメント数を表示
  pnpm fs:describe <collection_path>   コレクション構造を表示（サンプルから推測）
  pnpm fs:query <collection> [条件]     ドキュメントを取得

クエリ例:
  pnpm fs:query chat_rooms
  pnpm fs:query chat_rooms status == active
  pnpm fs:query chat_rooms createdAt > 2024-01-01 --limit 5
  pnpm fs:query chat_rooms status in '["active","pending"]'

サブコレクション:
  pnpm fs:collections chat_rooms/abc123
  pnpm fs:describe chat_rooms/abc123/messages
`);
      process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("エラー:", error.message || error);
  process.exit(1);
});
