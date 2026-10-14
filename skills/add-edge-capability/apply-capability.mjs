#!/usr/bin/env node
// Copies a capability's install/ files into an edge-stack project and applies its
// install-patches/, rendering the template placeholders in both first.
//
//   node apply-capability.mjs <capability-dir> [--project <dir>] [--set TOKEN=value ...]
//                             [--glue-only]
//
// A patch that no longer applies (the file changed since the base template, e.g.
// another capability touched it) is retried as a 3-way merge. The patches are cut
// against the placeholdered template, so the blob their `index` line names never
// exists in a renamed project; the rendered template file is written into the
// project's object store and the patch pointed at it, which gives `git apply -3`
// the real merge base. Conflicts are left as markers for the caller to resolve.
//
// A capability that builds on others names them in capability.json `requires`.
// It is refused until the project has them, and its patches are cut against the
// template with them installed, so that is the merge base.
//
// Glue between two capabilities lives in <capability>/with/<other>/ (its own
// install/ and install-patches/, cut against the project with both installed).
// It is applied whichever of the two is installed second, once the
// capability's own files are in without conflicts — otherwise resolve them and
// re-run with --glue-only. Glue patches have no template merge base, so one
// that does not apply is reported as failed.
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    project: { type: "string", default: "." },
    set: { type: "string", multiple: true, default: [] },
    "glue-only": { type: "boolean", default: false },
  },
});
if (positionals.length !== 1) {
  console.error(
    "Usage: node apply-capability.mjs <capability-dir> [--project <dir>] [--set TOKEN=value ...] [--glue-only]",
  );
  process.exit(1);
}

const capabilityDir = resolve(positionals[0]);
const projectDir = resolve(values.project);
const capabilitiesDir = dirname(capabilityDir);
const templateDir = resolve(capabilitiesDir, "../template");
const manifest = JSON.parse(
  readFileSync(join(projectDir, ".edge-stack.json"), "utf8"),
);
const slug = manifest.name;
const required =
  JSON.parse(readFileSync(join(capabilityDir, "capability.json"), "utf8"))
    .requires ?? [];
const missing = required.filter((name) => !manifest.capabilities?.[name]);
if (missing.length > 0 && !values["glue-only"]) {
  console.error(
    `${basename(capabilityDir)} requires ${missing.join(", ")}: install ${missing.length > 1 ? "them" : "it"} first.`,
  );
  process.exit(1);
}
const today = new Date().toISOString().slice(0, 10);
const nowMs = Date.now();
const replacements = [
  ["project-name", slug],
  ["project_name", slug.replace(/-/g, "_")],
  ["REPLACE_WITH_TODAY", today],
  ["REPLACE_WITH_NOW", null],
  ...values.set.map((pair) => {
    const at = pair.indexOf("=");
    if (at < 1) {
      console.error(`--set expects TOKEN=value, got "${pair}"`);
      process.exit(1);
    }
    return [pair.slice(0, at), pair.slice(at + 1)];
  }),
];

// `date` replaces REPLACE_WITH_TODAY; a patch on a dated file (an ADR) passes the
// date in that file's name, since the file landed when the project was created.
// `now` replaces REPLACE_WITH_NOW: a capability's stamped files (its migrations)
// get consecutive seconds, in name order, so they keep their order.
function render(text, date = today, now = stamp()) {
  return replacements.reduce(
    (out, [token, value]) =>
      out
        .split(token)
        .join(
          token === "REPLACE_WITH_TODAY"
            ? date
            : token === "REPLACE_WITH_NOW"
              ? now
              : value,
        ),
    text,
  );
}

function stamp(offsetSeconds = 0) {
  return new Date(nowMs + offsetSeconds * 1000)
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);
}

// The project's copy of a dated template file, e.g. docs/adrs/2026-01-31_drizzle.md for
// docs/adrs/REPLACE_WITH_TODAY_drizzle.md.
function datedFileDate(templatePath) {
  if (!templatePath.includes("REPLACE_WITH_TODAY")) return { date: today };
  const dir = dirname(templatePath);
  const [before, after] = templatePath
    .slice(dir === "." ? 0 : dir.length + 1)
    .split("REPLACE_WITH_TODAY");
  const pattern = new RegExp(
    `^${escapeRegExp(before)}(\\d{4}-\\d{2}-\\d{2})${escapeRegExp(after)}$`,
  );
  const absoluteDir = join(projectDir, dir);
  const matches = existsSync(absoluteDir)
    ? readdirSync(absoluteDir).flatMap((name) => name.match(pattern)?.[1] ?? [])
    : [];
  if (matches.length !== 1) {
    return {
      error: `expected exactly one ${templatePath.replace("REPLACE_WITH_TODAY", "<date>")} in the project, found ${matches.length}`,
    };
  }
  return { date: matches[0] };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath ?? entry.path, entry.name)))
    .sort();
}

function git(args, input) {
  return spawnSync("git", args, { cwd: projectDir, input, encoding: "utf8" });
}

function copyInstallFiles(partDir) {
  const installDir = join(partDir, "install");
  let stamped = 0;
  for (const file of filesUnder(installDir)) {
    const now = file.includes("REPLACE_WITH_NOW") ? stamp(stamped++) : undefined;
    const target = join(projectDir, render(file, today, now));
    mkdirSync(dirname(target), { recursive: true });
    const source = join(installDir, file);
    const content = readFileSync(source);
    if (content.includes(0)) {
      cpSync(source, target);
    } else {
      writeFileSync(target, render(content.toString("utf8")));
    }
    console.log(`copied   ${relative(projectDir, target)}`);
  }
}

// Points the patch's pre-image at the rendered base file, written into the
// project's object store so `git apply -3` can find it.
function seedMergeBase(patchText, templatePath, date) {
  const base = baseText(templatePath);
  if (base === null) return patchText;
  const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], {
    cwd: projectDir,
    input: render(base, date),
    encoding: "utf8",
  }).trim();
  return patchText.replace(/^index [0-9a-f]+\.\./m, `index ${blob}..`);
}

// The placeholdered file as the template has it once the required capabilities
// are installed: their install/ copy, or the template's with their patch.
function baseText(templatePath) {
  const templateFile = join(templateDir, templatePath);
  let text = existsSync(templateFile)
    ? readFileSync(templateFile, "utf8")
    : null;
  for (const name of required) {
    const part = join(capabilitiesDir, name);
    const installed = join(part, "install", templatePath);
    const patch = join(part, "install-patches", `${templatePath}.patch`);
    if (existsSync(installed)) {
      text = readFileSync(installed, "utf8");
    } else if (text !== null && existsSync(patch)) {
      text = patched(text, templatePath, patch);
    }
  }
  return text;
}

function patched(text, path, patch) {
  const dir = mkdtempSync(join(tmpdir(), "edge-capability-base-"));
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
  execFileSync("git", ["apply", patch], { cwd: dir });
  return readFileSync(join(dir, path), "utf8");
}

function applyPatches(partDir, { seedFromTemplate }, results) {
  const patchDir = join(partDir, "install-patches");
  const renderedDir = mkdtempSync(join(tmpdir(), "edge-capability-"));
  for (const file of filesUnder(patchDir)) {
    const raw = readFileSync(join(patchDir, file), "utf8");
    const templatePath =
      raw.match(/^--- a\/(.+)$/m)?.[1] ?? file.replace(/\.patch$/, "");
    const { date, error } = datedFileDate(templatePath);
    if (error) {
      results.failed.push(`${templatePath}\n      ${error}`);
      continue;
    }
    const text = render(raw, date);
    const path = render(templatePath, date);
    const rendered = join(renderedDir, file);
    mkdirSync(dirname(rendered), { recursive: true });
    writeFileSync(rendered, text);

    if (git(["apply", "--check", rendered]).status === 0) {
      git(["apply", rendered]);
      results.applied.push(path);
      continue;
    }
    if (!seedFromTemplate) {
      const check = git(["apply", "--check", rendered]);
      results.failed.push(
        `${path}  (patch: ${rendered})\n      ${check.stderr.trim().split("\n").join("\n      ")}`,
      );
      continue;
    }
    writeFileSync(rendered, seedMergeBase(text, templatePath, date));
    const merge = git(["apply", "-3", rendered]);
    const unmerged = git(["diff", "--name-only", "--diff-filter=U", "--", path]);
    if (unmerged.stdout.trim()) {
      results.conflicted.push(`${path}  (patch: ${rendered})`);
    } else if (merge.status === 0) {
      results.merged.push(path);
    } else {
      results.failed.push(
        `${path}  (patch: ${rendered})\n      ${merge.stderr.trim().split("\n").join("\n      ")}`,
      );
    }
  }
}

// The glue directories to apply next to the capability: with/<other>/ on either
// side, for every other capability the project already has.
function glueParts() {
  const name = basename(capabilityDir);
  return Object.keys(manifest.capabilities ?? {})
    .filter((other) => other !== "base" && other !== name)
    .flatMap((other) => [
      join(capabilityDir, "with", other),
      join(capabilitiesDir, other, "with", name),
    ])
    .filter((dir) => existsSync(dir));
}

const results = { applied: [], merged: [], conflicted: [], failed: [] };
if (!values["glue-only"]) {
  copyInstallFiles(capabilityDir);
  applyPatches(capabilityDir, { seedFromTemplate: true }, results);
}
const glue = glueParts();
const gluePending =
  glue.length > 0 && results.conflicted.length + results.failed.length > 0;
if (!gluePending) {
  for (const glueDir of glue) {
    console.log(`\nglue: ${relative(capabilitiesDir, glueDir)}`);
    copyInstallFiles(glueDir);
    applyPatches(glueDir, { seedFromTemplate: false }, results);
  }
}
const report = [
  ["applied cleanly", results.applied],
  ["3-way merged cleanly (review the diff)", results.merged],
  ["CONFLICTS — resolve the markers by intent", results.conflicted],
  ["FAILED — apply these by intent", results.failed],
];
for (const [label, paths] of report) {
  if (paths.length === 0) continue;
  console.log(`\n${label}:`);
  for (const path of paths) console.log(`  ${path}`);
}
if (gluePending) {
  console.log(
    `\nGLUE PENDING — after resolving the above, re-run with --glue-only to apply:\n${glue.map((dir) => `  ${relative(capabilitiesDir, dir)}`).join("\n")}`,
  );
}
process.exit(results.conflicted.length + results.failed.length > 0 ? 2 : 0);
