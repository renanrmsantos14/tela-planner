import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultPort = 5192;
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const pidFile = path.join(os.tmpdir(), "tela-planner-vite-5192.pid");

function getListeners() {
  const output = execFileSync("netstat.exe", ["-ano", "-p", "tcp"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  return output
    .split(/\r?\n/)
    .filter((line) => /^\s*TCP\s+/i.test(line) && /\sLISTENING\s+/i.test(line))
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const localEndpoint = parts[1] || "";
      return {
        port: Number(localEndpoint.slice(localEndpoint.lastIndexOf(":") + 1)),
        pid: Number(parts.at(-1)),
      };
    })
    .filter((listener) => Number.isInteger(listener.port) && Number.isInteger(listener.pid));
}

function killProcess(pid) {
  process.kill(pid, "SIGTERM");
}

function stopPreviousDevServer() {
  if (!existsSync(pidFile)) return;

  const previousPid = Number(readFileSync(pidFile, "utf8").trim());
  if (Number.isInteger(previousPid) && previousPid > 0) {
    try {
      console.log(`Encerrando servidor anterior (PID ${previousPid})...`);
      killProcess(previousPid);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }

  unlinkSync(pidFile);
}

function isPortBusy(port) {
  return getListeners().some((listener) => listener.port === port);
}

function waitForPortRelease(port) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!isPortBusy(port)) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error(`Porta ${port} continua ocupada após reiniciar o projeto.`);
}

if (!existsSync(viteBin)) {
  throw new Error(`Vite não encontrado em ${viteBin}. Rode npm install antes de iniciar o dev.`);
}

stopPreviousDevServer();

let port = defaultPort;
const listener = getListeners().find((item) => item.port === defaultPort);

if (listener) {
  console.log(`Porta ${defaultPort} já estava em uso (PID ${listener.pid}). Reiniciando...`);
  killProcess(listener.pid);
  waitForPortRelease(defaultPort);
}

const child = spawn(process.execPath, [viteBin, "--host", "localhost", "--port", String(port), "--strictPort"], {
  cwd: projectRoot,
  stdio: "inherit",
});

writeFileSync(pidFile, String(child.pid), "utf8");

child.on("exit", (code, signal) => {
  if (existsSync(pidFile) && readFileSync(pidFile, "utf8").trim() === String(child.pid)) {
    unlinkSync(pidFile);
  }
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
