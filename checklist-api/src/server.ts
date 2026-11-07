import { buildApp } from "./app.js";
import { loadSnapshot } from "./snapshots.js";
let snapshot = await loadSnapshot();
const origins = (
  process.env.CORS_ORIGINS ??
  "http://localhost:5173,http://127.0.0.1:5173,http://10.0.2.2:5173"
)
  .split(",")
  .map((s) => s.trim());
if (origins.some((o) => o === "*" || new URL(o).origin !== o))
  throw new Error("CORS_ORIGINS 必須是明確的 Origin，不能包含路徑或萬用字元");
const app = buildApp(() => snapshot, origins);
const timer = setInterval(async () => {
  try {
    snapshot = await loadSnapshot();
  } catch {
    console.error("快照載入失敗，保留上一個已驗證版本");
  }
}, 60000);
timer.unref();
await app.listen({
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "127.0.0.1",
});
console.log(
  `Checklist API listening on ${(app.server.address() && process.env.PORT) || 3001}; snapshot ${snapshot.version}`,
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    clearInterval(timer);
    await app.close();
    process.exit(0);
  });
