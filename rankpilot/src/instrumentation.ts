export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startRuntime } = await import("./lib/runtime-start");
  await startRuntime();
}
