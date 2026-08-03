import { readFile } from "node:fs/promises";

const html = await readFile("dist/webresource.html", "utf8");
if (!html.includes("Tela Planner")) throw new Error("Título do webresource não encontrado.");
const markup = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
if (/<(?:script|link)[^>]+(?:src|href)="\/assets\//.test(markup)) throw new Error("webresource ainda contém referências externas a /assets/.");
if (!html.includes("id=\"root\"")) throw new Error("Mount point do React não encontrado.");
console.log(`webresource validado (${Buffer.byteLength(html, "utf8")} bytes)`);
