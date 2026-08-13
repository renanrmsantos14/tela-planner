import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultPort = 5190;
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");

function runPowerShell(command) {
  return execFileSync("powershell.exe", ["-NoProfile", "-Command", command], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function getListeners() {
  const output = execFileSync("netstat.exe", ["-ano", "-p", "tcp"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i))
    .filter(Boolean)
    .map((match) => ({ port: Number(match[1]), pid: Number(match[2]) }));
}

function getProcess(pid) {
  let output;
  try {
    output = runPowerShell(
      `Get-CimInstance Win32_Process -Filter \"ProcessId = ${pid}\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress`
    );
  } catch {
    return null;
  }
  if (!output) return null;
  const process = JSON.parse(output);
  return {
    pid: Number(process.ProcessId),
    commandLine: String(process.CommandLine || ""),
  };
}

function isSameProject(process) {
  const root = projectRoot.toLowerCase().replaceAll("/", "\\");
  return process?.commandLine.toLowerCase().replaceAll("/", "\\").includes(root);
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

function choosePort() {
  let port = defaultPort;
  while (isPortBusy(port)) port += 1;
  return port;
}

if (!existsSync(viteBin)) {
  throw new Error(`Vite não encontrado em ${viteBin}. Rode npm install antes de iniciar o dev.`);
}

let port = defaultPort;
const listener = getListeners().find((item) => item.port === defaultPort);

if (listener) {
  const owner = getProcess(listener.pid);
  if (isSameProject(owner)) {
    console.log(`Projeto já estava rodando na porta ${defaultPort}. Reiniciando...`);
    killProcessTree(listener.pid);
    waitForPortRelease(defaultPort);
  } else {
    port = choosePort();
    console.log(`Porta ${defaultPort} está em uso por outro projeto. Usando ${port}.`);
  }
}

const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: projectRoot,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
