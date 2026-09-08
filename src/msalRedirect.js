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
    const dataversePath = /\/webresources\//i.test(pathname)
      ? pathname.replace(/\/[^/]*$/, `/${redirectResourceName}`)
      : `/WebResources/${redirectResourceName}`;
    return `${origin}${dataversePath}`;
  }
  return String(configuredRedirectUri || fallbackRedirect).trim();
}
