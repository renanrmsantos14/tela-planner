import { build } from "vite";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
  root: projectRoot,
  configFile: false,
  publicDir: false,
  build: {
    outDir: path.resolve(projectRoot, "dist"),
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(projectRoot, "redirect.html"),
      output: { inlineDynamicImports: true },
    },
  },
});

const redirectPath = path.resolve(projectRoot, "dist", "redirect.html");
let redirectHtml = await readFile(redirectPath, "utf8");
const externalScript = redirectHtml.match(/<script type="module"[^>]+src="([^"]+)"[^>]*><\/script>/i);
if (!externalScript) throw new Error("Bundle do redirect bridge não encontrado em dist/redirect.html");

const scriptPath = path.resolve(projectRoot, "dist", externalScript[1].replace(/^\//, ""));
const scriptContent = await readFile(scriptPath, "utf8");
redirectHtml = redirectHtml.replace(externalScript[0], `<script type="module">${scriptContent}</script>`);
await writeFile(redirectPath, redirectHtml, "utf8");

console.log("redirect.html gerado com o MSAL redirect bridge inline");
