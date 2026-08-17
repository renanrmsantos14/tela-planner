import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = resolve(root, "package.json");
const lockPath = resolve(root, "package-lock.json");
const runtimeVersionPath = resolve(root, "src", "version.js");

export function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Versão inválida em package.json: ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

export function formatDisplayVersion(version, date = new Date()) {
  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  return `v${version} ${formattedDate}`;
}

function replaceRootVersions(text, currentVersion, nextVersion, occurrences) {
  const pattern = new RegExp(`(\\"version\\"\\s*:\\s*)\\"${currentVersion.replaceAll(".", "\\.")}\\"`, "g");
  let replaced = 0;
  return text.replace(pattern, (match, prefix) => {
    if (replaced >= occurrences) return match;
    replaced += 1;
    return `${prefix}\"${nextVersion}\"`;
  });
}

export async function writeVersion() {
  const packageText = await readFile(packagePath, "utf8");
  const currentVersion = JSON.parse(packageText).version;
  const nextVersion = bumpPatch(currentVersion);
  const displayVersion = formatDisplayVersion(nextVersion);
  const lockText = await readFile(lockPath, "utf8");

  await writeFile(packagePath, replaceRootVersions(packageText, currentVersion, nextVersion, 1), "utf8");
  await writeFile(lockPath, replaceRootVersions(lockText, currentVersion, nextVersion, 2), "utf8");
  await writeFile(runtimeVersionPath, `// Gerado automaticamente por scripts/write-version.mjs.\nexport const APP_VERSION = \"${displayVersion}\";\n`, "utf8");

  console.log(`Versão atualizada: ${displayVersion}`);
  return displayVersion;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeVersion();
}
