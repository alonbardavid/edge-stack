#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

function main() {
  const name = process.argv.slice(2).join(" ").trim();
  const slug = toSlug(name);
  if (!slug) {
    console.error("Usage: pnpm db:new <name>");
    process.exit(1);
  }
  const file = join(migrationsDir, `${timestamp()}_${slug}.sql`);
  writeFileSync(file, "", { flag: "wx" });
  console.log(
    `Created ${relative(process.cwd(), file)} — write your SQL there, then run pnpm db:migrate.`,
  );
}

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function timestamp() {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14);
}

main();
