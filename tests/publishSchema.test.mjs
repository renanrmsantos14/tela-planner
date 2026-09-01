import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../scripts/publish-webresource.ps1", import.meta.url), "utf8");
const wrapper = readFileSync(new URL("../scripts/publish-webresource.cmd", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("npm run push provisiona lookup direto de equipe do Planner", () => {
  assert.match(script, /-SchemaName "cr40f_PlannerTarefa_EquipePlanner"/);
  assert.match(script, /-ReferencingEntity "cr40f_plannertarefa"/);
  assert.match(script, /-ReferencingAttribute "cr40f_EquipePlanner"/);
  assert.match(script, /-ReferencedEntity "cr40f_plannerequipe"/);
});

test("npm run push aborta conflito de lookup sem apagar metadata", () => {
  assert.match(script, /existingForAttribute/);
  assert.match(script, /não altere nem apague o lookup existente automaticamente/);
});

test("npm run push usa Windows PowerShell para carregar MSAL.PS", () => {
  assert.match(packageJson.scripts.push, /cmd\.exe \/d \/c scripts\\publish-webresource\.cmd/);
  assert.match(wrapper, /WindowsPowerShell\\v1\.0\\powershell\.exe/);
  assert.match(wrapper, /-DeviceCode/);
  assert.match(script, /Import-Module Microsoft\.PowerShell\.Utility/);
  assert.match(script, /function global:Import-PowerShellDataFile/);
});
