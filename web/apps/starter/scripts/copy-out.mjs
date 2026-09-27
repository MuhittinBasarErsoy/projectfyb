// `next build` (output: "export") çıktısını sunucunun wwwroot/starter klasörüne kopyalar.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "out");
const target = resolve(root, "../../../src/FyBlue.Server/wwwroot/starter");

if (!existsSync(out)) throw new Error("out/ bulunamadı; önce `next build` çalışmalı.");
rmSync(target, { recursive: true, force: true });
cpSync(out, target, { recursive: true });
console.log(`Kopyalandı: ${out} → ${target}`);
