import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultPort = 5192;
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");

function getListeners() {
  const output = execFileSync("netstat.exe", ["-ano", "-p", "tcp"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts[0]?.toUpperCase() === "TCP" && parts[3]?.toUpperCase() === "LISTENING")
    .map((parts) => ({
      port: Number(parts[1].slice(parts[1].lastIndexOf(":") + 1)),
      pid: Number(parts[4]),
    }))
    .filter((listener) => Number.isInteger(listener.port) && Number.isInteger(listener.pid));
}

function killProcessTree(pid) {
  execFileSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
    cwd: projectRoot,
    stdio: "ignore",
  });
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

let port = defaultPort;
const listener = getListeners().find((item) => item.port === defaultPort);

if (listener) {
  console.log(`Porta ${defaultPort} já estava em uso (PID ${listener.pid}). Reiniciando...`);
  killProcessTree(listener.pid);
  waitForPortRelease(defaultPort);
}

const child = spawn(process.execPath, [viteBin, "--host", "localhost", "--port", String(port), "--strictPort"], {
  cwd: projectRoot,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
