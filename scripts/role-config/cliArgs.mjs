// role:delete / prof:delete / role:toggle / prof:generate の引数の解釈（共通）。
// 既定は対話なし（引数で決める）。-i / --interactive のときだけ今までの対話

/**
 * @param {string[]} argv process.argv.slice(2)
 * @param {{ values?: string[], flags?: string[] }} spec values = 値を取るオプション名、flags = 値を取らないオプション名
 * @returns {{ positional: string | undefined, interactive: boolean, values: Record<string, string>, flags: Set<string> }}
 */
export function parseRoleOpsArgs(argv, { values = [], flags = [] } = {}) {
  const args = argv.filter((arg) => arg !== "--");
  const result = { positional: undefined, interactive: false, values: {}, flags: new Set() };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-i" || arg === "--interactive") {
      result.interactive = true;
      continue;
    }
    const name = arg.startsWith("--") ? arg.slice(2).split("=")[0] : null;
    if (name !== null && values.includes(name)) {
      const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : args[++i];
      if (value === undefined || value.startsWith("-")) throw new Error(`--${name} に値を指定してください`);
      result.values[name] = value;
    } else if (name !== null && flags.includes(name)) {
      result.flags.add(name);
    } else if (arg.startsWith("-")) {
      throw new Error(`知らないオプションです: ${arg}`);
    } else if (result.positional === undefined) {
      result.positional = arg;
    } else {
      throw new Error(`引数が多すぎます: ${arg}`);
    }
  }
  return result;
}

/** 引数の誤り・足りない引数で止める（使い方を出して終了コード 1） */
export function failUsage(message, usage) {
  console.error(`エラー: ${message}`);
  console.error(`使い方: ${usage}`);
  process.exitCode = 1;
}
