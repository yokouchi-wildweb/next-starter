// CLI の共通の入口。例外はメッセージだけを出して終了コード 1（スタックトレースは出さない）

/**
 * @param {() => Promise<void> | void} main
 */
export async function runCli(main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
