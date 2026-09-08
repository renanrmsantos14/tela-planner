import { InteractionRequiredAuthError, PublicClientApplication } from "@azure/msal-browser";

const clientId = String(import.meta.env?.VITE_MSAL_CLIENT_ID || "").trim();
const tenantId = String(import.meta.env?.VITE_MSAL_TENANT_ID || "organizations").trim();
const appRedirect = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "http://localhost:5192/";
const fallbackRedirect = typeof window !== "undefined" ? `${window.location.origin}/redirect.html` : "http://localhost:5192/redirect.html";
const configuredRedirectUri = String(import.meta.env?.VITE_MSAL_REDIRECT_URI || fallbackRedirect).trim();

export const msalConfigured = Boolean(clientId);
export const plannerScopes = ["User.Read", "Tasks.Read", "User.ReadBasic.All"];

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: configuredRedirectUri,
    postLogoutRedirectUri: appRedirect,
  },
  system: {
    // Falha rápido quando o popup não consegue devolver a resposta ao app.
    popupBridgeTimeout: 15000,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const msalInstance = msalConfigured ? new PublicClientApplication(msalConfig) : null;

let initialized = false;
let interactionPromise = null;

function runInteraction(action) {
  if (interactionPromise) return interactionPromise;
  interactionPromise = Promise.resolve().then(action).finally(() => {
    interactionPromise = null;
  });
  return interactionPromise;
}

export async function ensureMsalInitialized() {
  if (!msalInstance) throw new Error("Autenticação Microsoft não configurada neste ambiente.");
  if (!initialized) {
    await msalInstance.initialize();
    initialized = true;
  }
  return msalInstance;
}

function activeAccount(instance) {
  return instance.getActiveAccount() || instance.getAllAccounts()[0] || null;
}

function assertRedirectBridgeOrigin() {
  if (typeof window === "undefined") return;

  const redirectOrigin = new URL(msalConfig.auth.redirectUri, window.location.origin).origin;
  if (redirectOrigin === window.location.origin) return;

  const error = new Error(
    `O app está aberto em ${window.location.origin}, mas o retorno Microsoft está configurado para ${redirectOrigin}. Abra o app no endereço cadastrado no Microsoft Entra ID.`
  );
  error.errorCode = "redirect_bridge_origin_mismatch";
  throw error;
}

export async function loginMicrosoft() {
  assertRedirectBridgeOrigin();
  const instance = await ensureMsalInitialized();
  return runInteraction(async () => {
    const response = await instance.loginPopup({
      scopes: plannerScopes,
      redirectUri: msalConfig.auth.redirectUri,
      prompt: "select_account",
      // O app controla uma única interação; isso limpa um flag órfão deixado por popup fechado.
      overrideInteractionInProgress: true,
    });
    if (response.account) instance.setActiveAccount(response.account);
    return response.account || activeAccount(instance);
  });
}

export async function acquirePlannerToken() {
  assertRedirectBridgeOrigin();
  const instance = await ensureMsalInitialized();
  let account = activeAccount(instance);
  if (!account) account = await loginMicrosoft();
  try {
    const response = await instance.acquireTokenSilent({ account, scopes: plannerScopes });
    return response.accessToken;
  } catch (error) {
    if (!(error instanceof InteractionRequiredAuthError)) throw error;
    return runInteraction(async () => {
      const response = await instance.acquireTokenPopup({
        account,
        scopes: plannerScopes,
        overrideInteractionInProgress: true,
      });
      return response.accessToken;
    });
  }
}

export async function logoutMicrosoft() {
  const instance = await ensureMsalInitialized();
  await runInteraction(() => instance.logoutPopup({ account: activeAccount(instance) || undefined }));
}

export async function getMicrosoftAccount() {
  if (!msalInstance) return null;
  const instance = await ensureMsalInitialized();
  return activeAccount(instance);
}
