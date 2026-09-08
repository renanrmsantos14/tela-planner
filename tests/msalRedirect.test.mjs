import test from "node:test";
import assert from "node:assert/strict";
import { resolvePlannerRedirectUri } from "../src/msalRedirect.js";

test("mantém o redirect configurado no localhost", () => {
  assert.equal(
    resolvePlannerRedirectUri({
      origin: "http://localhost:5192",
      pathname: "/",
      search: "",
      configuredRedirectUri: "http://localhost:5192/redirect.html",
      fallbackRedirect: "http://localhost:5192/redirect.html",
    }),
    "http://localhost:5192/redirect.html"
  );
});

test("gera o redirect bridge no mesmo ambiente do WebResource aberto pelo main.aspx", () => {
  assert.equal(
    resolvePlannerRedirectUri({
      origin: "https://org23b93544.crm2.dynamics.com",
      pathname: "/main.aspx",
      search: "?appid=7c7c8fda-53d0-f011-8543-6045bd3a51ea&pagetype=webresource&webresourceName=new_TelaPlanner.html",
      configuredRedirectUri: "http://localhost:5192/redirect.html",
      fallbackRedirect: "http://localhost:5192/redirect.html",
    }),
    "https://org23b93544.crm2.dynamics.com/WebResources/new_TelaPlanner_redirect.html"
  );
});

test("preserva o caminho do WebResource quando o Dataverse o expõe diretamente", () => {
  assert.equal(
    resolvePlannerRedirectUri({
      origin: "https://orgf261ae8e.crm2.dynamics.com",
      pathname: "/WebResources/new_TelaPlanner.html",
      search: "",
      redirectResourceName: "new_TelaPlanner_redirect.html",
    }),
    "https://orgf261ae8e.crm2.dynamics.com/WebResources/new_TelaPlanner_redirect.html"
  );
});
