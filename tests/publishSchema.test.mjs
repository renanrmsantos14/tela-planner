import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../scripts/publish-webresource.ps1", import.meta.url), "utf8");
const wrapper = readFileSync(new URL("../scripts/publish-webresource.cmd", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("npm run push provisiona lookup direto de equipe do Planner", () => {
  assert.match(script, /Ensure-PlannerStringAttribute \$Headers \$ApiBaseUrl \$team "cr40f_Icone" "Ícone da equipe" 100/);
  assert.match(script, /-SchemaName "cr40f_PlannerTarefa_EquipePlanner"/);
  assert.match(script, /-ReferencingEntity "cr40f_plannertarefa"/);
  assert.match(script, /-ReferencingAttribute "cr40f_EquipePlanner"/);
  assert.match(script, /-ReferencedEntity "cr40f_plannerequipe"/);
  assert.match(script, /cr40f_PlannerEquipe_ResponsavelPrincipal/);
  assert.match(script, /-ReferencingAttribute "cr40f_ResponsavelPrincipal"/);
  assert.match(script, /-ReferencedEntity "cr40f_funcionarios"/);
});

test("npm run push aborta conflito de lookup sem apagar metadata", () => {
  assert.match(script, /existingForAttribute/);
  assert.match(script, /não altere nem apague o lookup existente automaticamente/);
});

test("npm run push usa Windows PowerShell para carregar MSAL.PS", () => {
  const pushDev = readFileSync(new URL("../scripts/push-dev.ps1", import.meta.url), "utf8");
  assert.match(packageJson.scripts.push, /push-dev\.ps1/);
  assert.match(pushDev, /windowsPowerShell/);
  assert.match(pushDev, /publish-webresource\.ps1/);
  assert.match(pushDev, /register-planner-notification-plugin\.ps1/);
  assert.match(wrapper, /WindowsPowerShell\\v1\.0\\powershell\.exe/);
  assert.match(wrapper, /-DeviceCode/);
  assert.match(script, /Import-Module Microsoft\.PowerShell\.Utility/);
  assert.match(script, /function global:Import-PowerShellDataFile/);
  assert.match(script, /Guid\]::TryParse\(\$ClientId/);
  assert.match(script, /DV_CLIENT_ID/);
});

test("npm run push publica o redirect bridge do MSAL no Dataverse", () => {
  assert.match(script, /new_TelaPlanner_redirect\.html/);
  assert.match(script, /dist\\redirect\.html/);
  assert.match(script, /Tela Planner - MSAL redirect/);
  assert.match(script, /redirectPublishXml/);
});

test("build do redirect bridge embute o bundle no HTML publicado", () => {
  const bridgeBuild = readFileSync(new URL("../scripts/build-redirect-bridge.mjs", import.meta.url), "utf8");
  assert.match(bridgeBuild, /readFile\(redirectPath/);
  assert.match(bridgeBuild, /replace\(externalScript\[0\]/);
  assert.match(bridgeBuild, /writeFile\(redirectPath/);
});
