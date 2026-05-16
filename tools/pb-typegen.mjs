/**
 * Regenera tipos TypeScript desde el schema de PocketBase (multiplataforma, sin bash).
 * Uso: npm run pb:types
 *
 * Requiere: DB en docker/pb_data/data.db (o ajustá las rutas abajo).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = join(root, "docker", "pb_data", "data.db");
const out = join(root, "shared-types", "src", "lib", "pocketbase-types.ts");

if (!existsSync(db)) {
  console.error(`[pb:types] No se encontró la base: ${db}`);
  console.error("Copiá data.db ahí o cambiá la ruta en tools/pb-typegen.mjs");
  process.exit(1);
}

console.log("=> Generando tipos de PocketBase...");

const q = (p) => `"${String(p).replace(/"/g, '\\"')}"`;
const cmd = `npx pocketbase-typegen --db ${q(db)} --out ${q(out)}`;

const result = spawnSync(cmd, {
  stdio: "inherit",
  cwd: root,
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
if (result.status !== 0 && result.status !== null) {
  process.exit(result.status);
}

console.log("=> Tipos generados:", out);
