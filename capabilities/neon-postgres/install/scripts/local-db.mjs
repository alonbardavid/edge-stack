#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEV_DATABASE_URL,
  LOCAL_DB,
  localConnectionString,
} from "./lib/local-db-config.mjs";
import { migrateUp } from "./lib/migrator.mjs";
import { withPgClient } from "./lib/pg.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(repoRoot, ".pgdata");
const pidFile = join(dataDir, "local-db.pid");
const logFile = join(dataDir, "local-db.log");

async function isRunning() {
  return new Promise((resolve) => {
    const socket = net
      .connect({ host: LOCAL_DB.host, port: LOCAL_DB.port })
      .on("connect", () => {
        socket.end();
        resolve(true);
      })
      .on("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function ensureStarted() {
  if (await isRunning()) {
    return false;
  }
  await launch();
  return true;
}

async function launch() {
  mkdirSync(dataDir, { recursive: true });
  // The server is detached, so its output only survives in a log file — which
  // is the only place a startup failure is visible.
  const log = openSync(logFile, "a");
  const child = spawn(
    process.execPath,
    [join(repoRoot, "scripts/local-db-server.mjs")],
    {
      cwd: repoRoot,
      detached: true,
      stdio: ["ignore", log, log],
    },
  );
  child.unref();
  writeFileSync(pidFile, String(child.pid));
  await waitForPort();
  await waitForDatabases();
  console.info(
    `[local-db] postgres ready on port ${LOCAL_DB.port} (${Object.values(LOCAL_DB.databases).join(", ")})`,
  );
}

// Also brings the dev database to the latest migration, so `pnpm dev` (whose
// predev runs this) never starts against a stale schema. The test database is
// migrated by tests/global-setup.ts.
async function start() {
  if (await isRunning()) {
    console.info(`[local-db] already running on port ${LOCAL_DB.port}`);
  } else {
    await launch();
  }
  const applied = await withPgClient(DEV_DATABASE_URL, migrateUp);
  console.info(
    applied.length > 0
      ? `[local-db] dev database migrated: ${applied.join(", ")}`
      : "[local-db] dev database is up to date",
  );
}

async function stop() {
  if (!existsSync(pidFile)) {
    console.info("[local-db] no pid file, nothing to stop");
    return;
  }
  const pid = Number(readFileSync(pidFile, "utf8").trim());
  try {
    process.kill(pid, "SIGTERM");
    console.info(`[local-db] stopped (pid ${pid})`);
  } catch {
    console.info(`[local-db] process ${pid} was not running`);
  }
  rmSync(pidFile, { force: true });
}

async function waitForPort() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await isRunning()) {
      return;
    }
    await delay(250);
  }
  throw new Error(
    `[local-db] postgres did not open port ${LOCAL_DB.port} in time\n${readLogTail()}`,
  );
}

// The port opens before the server has created the databases.
async function waitForDatabases() {
  const deadline = Date.now() + 30_000;
  for (const database of Object.values(LOCAL_DB.databases)) {
    for (;;) {
      try {
        await withPgClient(localConnectionString(database), (client) =>
          client.query("SELECT 1"),
        );
        break;
      } catch (err) {
        if (Date.now() > deadline) {
          throw new Error(
            `[local-db] database ${database} is not reachable: ${err.message}\n${readLogTail()}`,
            { cause: err },
          );
        }
        await delay(250);
      }
    }
  }
}

function readLogTail(lines = 20) {
  if (!existsSync(logFile)) {
    return `[local-db] no output at ${logFile}`;
  }
  const tail = readFileSync(logFile, "utf8")
    .trimEnd()
    .split("\n")
    .slice(-lines);
  return [`[local-db] last output from ${logFile}:`, ...tail].join("\n");
}

const COMMANDS = {
  start,
  // Starts the cluster only when nothing serves the port (CI runs a service
  // container there). Unlike `start`, it does not migrate the dev database.
  ensure: async () => {
    const started = await ensureStarted();
    if (!started) {
      console.info(`[local-db] already running on port ${LOCAL_DB.port}`);
    }
  },
  stop,
  status: async () => {
    const running = await isRunning();
    console.info(`[local-db] ${running ? "running" : "stopped"}`);
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = COMMANDS[process.argv[2] ?? "start"];
  if (!command) {
    console.error(`usage: local-db.mjs <${Object.keys(COMMANDS).join("|")}>`);
    process.exit(1);
  }
  await command();
}
