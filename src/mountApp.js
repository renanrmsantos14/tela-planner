export const ROOT_REGISTRY_KEY = "__telaPlannerReactRoot";

export function getOrCreateRoot({ host, rootElement, createRootFactory }) {
  const registered = host[ROOT_REGISTRY_KEY];
  if (registered?.element === rootElement) return registered.root;

  const root = createRootFactory(rootElement);
  host[ROOT_REGISTRY_KEY] = { element: rootElement, root };
  return root;
}
