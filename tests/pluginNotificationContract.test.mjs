import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("plugin de notificação é server-side e executa SendAppNotification", async () => {
  const source = await readFile(new URL("../power-platform/plugins/PlannerNotifications/PlannerTaskEventNotificationPlugin.cs", import.meta.url), "utf8");
  assert.match(source, /IPlugin/);
  assert.match(source, /context\.MessageName, "Create"/);
  assert.match(source, /cr40f_plannertarefaevento/);
  assert.match(source, /new OrganizationRequest\("SendAppNotification"\)/);
  assert.match(source, /new EntityReference\("systemuser", userId\)/);
  assert.match(source, /cr40f_usuariodataverse/);
  assert.match(source, /ActorMatchesInitiatingUser/);
  assert.match(source, /LoadAuthorizedEvent/);
  assert.match(source, /MaxRecipients = 50/);
  assert.match(source, /async/i);
});

test("registro do plugin é idempotente e inclui assembly e step na AppBetinhos", async () => {
  const script = await readFile(new URL("../scripts/register-planner-notification-plugin.ps1", import.meta.url), "utf8");
  assert.match(script, /SolutionUniqueName = "AppBetinhos"/);
  assert.match(script, /MSCRM\.SolutionUniqueName/);
  assert.match(script, /AddSolutionComponent/);
  assert.match(script, /Ensure-SolutionComponent[^\n]+ 91 /);
  assert.match(script, /Ensure-SolutionComponent[^\n]+ 92 /);
  assert.match(script, /asyncautodelete = \$false/);
  assert.match(script, /ismanaged/);
  assert.match(script, /-not \$Apply/);
});
