function isDataverseWebResourceLocation({ pathname = "", search = "" } = {}) {
  return /\/webresources\//i.test(pathname) || /(?:^|&)pagetype=webresource(?:&|$)/i.test(search.replace(/^\?/, ""));
}

export function resolvePlannerRedirectUri({
  origin = "",
  pathname = "",
  search = "",
  configuredRedirectUri = "",
  fallbackRedirect = "",
  redirectResourceName = "new_TelaPlanner_redirect.html",
} = {}) {
  if (isDataverseWebResourceLocation({ pathname, search })) {
    // O Dataverse pode inserir /%7bversão%7d/ na URL interna do WebResource.
    // O endpoint sem versão é estável e deve ser o redirect cadastrado no Entra.
    return `${origin}/WebResources/${redirectResourceName}`;
  }
  return String(configuredRedirectUri || fallbackRedirect).trim();
}
