/**
 * Gestionnaire de stockage de jetons en mémoire (NON SÉCURISÉ POUR LA PRODUCTION).
 * Pour une application réelle, utilisez une solution de stockage sécurisée
 * (ex: base de données chiffrée, gestionnaire de secrets, session serveur robuste).
 */

interface Tokens {
  access_token: string;
  refresh_token?: string; // Le refresh token est optionnel
  expires_in?: number;    // Durée de validité de l'access_token en secondes
  token_type?: string;
  obtained_at?: number;   // Timestamp de l'obtention du token (en secondes)
}

// ATTENTION: Stockage en mémoire. Les jetons seront perdus au redémarrage du serveur.
// Le refresh_token, en particulier, ne devrait jamais être stocké de cette manière en production.
let tokenData: Tokens | null = null;

export const storeTokens = (tokens: Tokens): void => {
  console.warn('[TokenStore] Stockage des jetons en mémoire. NE PAS UTILISER EN PRODUCTION TEL QUEL pour des refresh_tokens.');
  tokenData = {
    ...tokens,
    obtained_at: Math.floor(Date.now() / 1000) // Stocke le timestamp en secondes
  };
};

export const getTokens = (): Tokens | null => {
  if (!tokenData) {
    return null;
  }
  // Potentiellement vérifier ici si l'access_token est expiré avant de le retourner,
  // mais la logique de rafraîchissement sera gérée ailleurs pour l'instant.
  return tokenData;
};

export const clearTokens = (): void => {
  tokenData = null;
  console.log('[TokenStore] Jetons effacés de la mémoire.');
};

export const getAccessToken = (): string | null => {
  if (tokenData && tokenData.access_token) {
    // Vérifier si le token est expiré
    if (tokenData.expires_in && tokenData.obtained_at) {
      const expiresInSeconds = tokenData.expires_in;
      const obtainedAtSeconds = tokenData.obtained_at;
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (obtainedAtSeconds + expiresInSeconds <= nowInSeconds) {
        console.log('[TokenStore] L\'access token est expiré.');
        // Idéalement, ici on pourrait déclencher le flux de rafraîchissement
        // ou simplement retourner null pour que l'appelant le gère.
        return null;
      }
    }
    return tokenData.access_token;
  }
  return null;
};

export const getRefreshToken = (): string | null => {
  return tokenData?.refresh_token || null;
}
