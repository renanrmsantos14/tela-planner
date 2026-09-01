import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const dist = resolve("dist");
const indexPath = resolve(dist, "index.html");
let html = await readFile(indexPath, "utf8");
const audioSource = "/sounds/task-completed.m4a";
const audioPath = resolve(dist, audioSource.slice(1));
const audioBase64 = await readFile(audioPath, "base64");
html = html.replaceAll(audioSource, `data:audio/mp4;base64,${audioBase64}`);
const assetPattern = /(?:src|href)="(\/assets\/[^\"]+)"/g;
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const assets = [...html.matchAll(assetPattern)];
for (const [, assetPath] of assets) {
  const filePath = resolve(dist, assetPath.slice(1));
  const content = (await readFile(filePath, "utf8")).replaceAll(audioSource, `data:audio/mp4;base64,${audioBase64}`);
  const escapedPath = escapeRegExp(assetPath);
  if (assetPath.endsWith(".css")) html = html.replace(new RegExp(`<link[^>]+href="${escapedPath}"[^>]*>`), () => `<style>${content}</style>`);
  else html = html.replace(new RegExp(`<script[^>]+src="${escapedPath}"[^>]*><\\/script>`), () => `<script type="module">${content}</script>`);
}
await writeFile(resolve(dist, "webresource.html"), html, "utf8");
console.log("webresource.html gerado com assets inline");
