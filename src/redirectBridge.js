import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";

broadcastResponseToMainFrame().catch((error) => {
  console.error("Falha ao processar o retorno da autenticação Microsoft.", error);
});
