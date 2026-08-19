import { InteractionRequiredAuthError, PublicClientApplication } from "@azure/msal-browser";

const PHOTO_SCOPES = ["User.Read", "ProfilePhoto.Read.All"];
const photoCache = new Map();
let clientCache = null;
let lastConfig = null;

export function graphPhotoEndpoint(userId) {
  const normalizedId = String(userId || "").replace(/[{}]/g, "").trim();
  return normalizedId ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(normalizedId)}/photo/$value` : "";
}

async function graphClient({ clientId, tenantId, redirectUri }) {
  const key = `${clientId}:${tenantId}:${redirectUri}`;
  if (clientCache?.key === key) return clientCache.client;
  const client = new PublicClientApplication({
    auth: { clientId, authority: `https://login.microsoftonline.com/${tenantId}`, redirectUri },
    cache: { cacheLocation: "sessionStorage" },
  });
  await client.initialize();
  clientCache = { key, client };
  return client;
}

async function accessToken(config) {
  const client = await graphClient(config);
  const account = client.getAllAccounts()[0];
  if (account) {
    try { return (await client.acquireTokenSilent({ account, scopes: PHOTO_SCOPES })).accessToken; }
    catch (error) { if (!(error instanceof InteractionRequiredAuthError)) throw error; }
  }
  return (await client.ssoSilent({ scopes: PHOTO_SCOPES, loginHint: config.loginHint || undefined })).accessToken;
}

export async function connectGraphSession() {
  if (!lastConfig) throw new Error("Configuração do Microsoft Graph ainda não foi carregada.");
  const client = clientCache?.client || await graphClient(lastConfig);
  await client.loginPopup({ scopes: PHOTO_SCOPES, loginHint: lastConfig.loginHint || undefined });
}

export async function loadGraphPhotoUrls(config, users) {
  if (!config?.clientId || !config?.tenantId || !config?.redirectUri) return new Map();
  lastConfig = config;
  const pending = users.filter((user) => graphPhotoEndpoint(user.azureObjectId) && !photoCache.has(user.azureObjectId));
  if (pending.length) {
    const token = await accessToken(config);
    await Promise.all(pending.map(async (user) => {
      try {
        const response = await fetch(graphPhotoEndpoint(user.azureObjectId), { headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 404) { photoCache.set(user.azureObjectId, ""); return; }
        if (!response.ok) throw new Error(`Graph photo ${response.status}`);
        const oldUrl = photoCache.get(user.azureObjectId);
        if (oldUrl && oldUrl.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
        photoCache.set(user.azureObjectId, URL.createObjectURL(await response.blob()));
      } catch (error) {
        photoCache.set(user.azureObjectId, "");
        console.warn(`Não foi possível carregar a foto Graph de ${user.azureObjectId}.`, error);
      }
    }));
  }
  return new Map(users.map((user) => [user.azureObjectId, photoCache.get(user.azureObjectId) || ""]));
}

export function clearPhotoCache() {
  photoCache.forEach((url) => { if (url && url.startsWith("blob:")) URL.revokeObjectURL(url); });
  photoCache.clear();
  clientCache = null;
  lastConfig = null;
}
