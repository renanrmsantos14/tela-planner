import { build } from "vite";
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

console.log("redirect.html gerado com o MSAL redirect bridge");
