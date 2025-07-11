import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { storeTokens, getAccessToken, getRefreshToken, clearTokens } from './token.store';

// Variables d'environnement attendues (à charger via un module comme dotenv)
const RAINDROP_CLIENT_ID = process.env.RAINDROP_CLIENT_ID;
const RAINDROP_CLIENT_SECRET = process.env.RAINDROP_CLIENT_SECRET;
const RAINDROP_REDIRECT_URI = process.env.RAINDROP_REDIRECT_URI;

const RAINDROP_AUTHORIZATION_URL = 'https://raindrop.io/oauth/authorize';
const RAINDROP_TOKEN_URL = 'https://raindrop.io/oauth/access_token';

/**
 * Redirige l'utilisateur vers la page d'autorisation de Raindrop.
 */
export const redirectToRaindrop = async (req: Request, res: Response) => {
  if (!RAINDROP_CLIENT_ID || !RAINDROP_REDIRECT_URI) {
    console.error('RAINDROP_CLIENT_ID ou RAINDROP_REDIRECT_URI n\'est pas défini.');
    return res.status(500).send('Configuration serveur incomplète.');
  }

  const state = uuidv4(); // Générer un état unique pour la sécurité CSRF
  // Stocker l'état dans la session pour vérification au callback
  if (req.session) {
    req.session.oauthState = state;
  } else {
    // Gérer le cas où la session n'est pas disponible, bien que cela ne devrait pas arriver
    // si express-session est correctement configuré.
    console.error('Session non disponible pour stocker l\'état OAuth.');
    return res.status(500).send('Erreur serveur : Impossible de sécuriser la requête OAuth.');
  }

  const params = new URLSearchParams({
    client_id: RAINDROP_CLIENT_ID,
    redirect_uri: RAINDROP_REDIRECT_URI,
    response_type: 'code',
    state: state,
  });

  const authorizationUrl = `${RAINDROP_AUTHORIZATION_URL}?${params.toString()}`;

  res.redirect(authorizationUrl);
};

import axios from 'axios';

/**
 * Gère le callback de Raindrop après que l'utilisateur ait autorisé l'application.
 * Échange le code d'autorisation contre un access_token.
 */
export const handleRaindropCallback = async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  const sessionState = req.session?.oauthState;

  // Nettoyer l'état de la session immédiatement après l'avoir récupéré
  if (req.session) {
    delete req.session.oauthState;
  }

  if (!state || !sessionState || state !== sessionState) {
    console.error('Invalid OAuth state. Session state:', sessionState, 'Query state:', state);
    return res.status(403).send('État OAuth invalide ou manquant. Tentative de CSRF possible.');
  }

  if (error) {
    console.error('Erreur lors du callback OAuth Raindrop:', error);
    return res.status(400).send(`Erreur de Raindrop: ${error}`);
  }

  if (!code) {
    return res.status(400).send('Code d\'autorisation manquant.');
  }

  if (!RAINDROP_CLIENT_ID || !RAINDROP_CLIENT_SECRET || !RAINDROP_REDIRECT_URI) {
    console.error('Variables d\'environnement OAuth manquantes pour l\'échange de token.');
    return res.status(500).send('Configuration serveur incomplète pour l\'échange de token.');
  }

  try {
    const tokenResponse = await axios.post(RAINDROP_TOKEN_URL, {
      client_id: RAINDROP_CLIENT_ID,
      client_secret: RAINDROP_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: RAINDROP_REDIRECT_URI,
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const { access_token, refresh_token, token_type, expires_in } = tokenResponse.data;

    // Étape 4: Stocker les jetons (en utilisant notre store en mémoire pour la démo)
    storeTokens({
      access_token,
      refresh_token,
      token_type,
      expires_in
    });

    console.log('Jetons stockés avec succès (en mémoire).');

    res.status(200).json({
      message: 'Authentification réussie ! Jetons stockés (en mémoire).',
      // Ne pas renvoyer les jetons ici directement dans une application réelle,
      // sauf si c'est explicitement pour le client (par ex. access_token pour une SPA).
      // Le refresh_token ne devrait JAMAIS être envoyé au client.
    });

  } catch (err) {
    console.error('Erreur lors de l\'échange du code contre un token:', err.response?.data || err.message);
    if (axios.isAxiosError(err) && err.response) {
      return res.status(err.response.status).json({
        message: 'Erreur lors de l\'échange du code contre un token.',
        error: err.response.data
      });
    }
    return res.status(500).send('Erreur interne du serveur lors de l\'échange de token.');
  }
};

/**
import { getAccessToken } from './token.store'; // Importer pour récupérer le token

const RAINDROP_API_BASE_URL = 'https://api.raindrop.io/rest/v1';

/**
 * Récupère les collections de l'utilisateur depuis l'API Raindrop en utilisant l'access_token stocké.
 */
export const getUserCollections = async (req: Request, res: Response) => {
  const accessToken = getAccessToken();

  if (!accessToken) {
    return res.status(401).json({
      message: 'Authentification requise. Aucun access token disponible ou token expiré.',
      redirectTo: '/auth/raindrop/login' // Suggérer à l'utilisateur de se reconnecter
    });
  }

  try {
    const response = await axios.get(`${RAINDROP_API_BASE_URL}/collections`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    res.status(200).json(response.data);

  } catch (error) {
    console.error('Erreur lors de la récupération des collections Raindrop:', error.response?.data || error.message);
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 401) {
        // Le token est peut-être invalide ou expiré malgré notre vérification précédente
        return res.status(401).json({
          message: 'Accès non autorisé. Le token est peut-être invalide ou expiré.',
          error: error.response.data,
          redirectTo: '/auth/raindrop/login'
        });
      }
      return res.status(error.response.status).json({
        message: 'Erreur de l\'API Raindrop lors de la récupération des collections.',
        error: error.response.data
      });
    }
    return res.status(500).send('Erreur interne du serveur lors de la récupération des collections.');
  }
};

import { getRefreshToken, storeTokens as updateStoredTokens, clearTokens } from './token.store'; // Fonctions de gestion des tokens

/**
 * Rafraîchit l'access_token en utilisant le refresh_token stocké.
 */
export const refreshToken = async (req: Request, res: Response) => {
  const currentRefreshToken = getRefreshToken();

  if (!currentRefreshToken) {
    return res.status(401).json({
      message: 'Aucun refresh token disponible. Veuillez vous authentifier à nouveau.',
      redirectTo: '/auth/raindrop/login'
    });
  }

  if (!RAINDROP_CLIENT_ID || !RAINDROP_CLIENT_SECRET) {
    console.error('RAINDROP_CLIENT_ID ou RAINDROP_CLIENT_SECRET n\'est pas défini pour le rafraîchissement du token.');
    return res.status(500).send('Configuration serveur incomplète pour le rafraîchissement du token.');
  }

  try {
    const response = await axios.post(RAINDROP_TOKEN_URL, {
      grant_type: 'refresh_token',
      refresh_token: currentRefreshToken,
      client_id: RAINDROP_CLIENT_ID,
      client_secret: RAINDROP_CLIENT_SECRET,
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const { access_token, refresh_token: new_refresh_token, token_type, expires_in } = response.data;

    // Mettre à jour les jetons stockés
    // Raindrop peut ou non renvoyer un nouveau refresh_token. S'il ne le fait pas, réutiliser l'ancien.
    storeTokens({
      access_token,
      refresh_token: new_refresh_token || currentRefreshToken, // Utiliser le nouveau refresh_token s'il est fourni
      token_type,
      expires_in,
    });

    console.log('Token rafraîchi avec succès et stocké.');
    res.status(200).json({ message: 'Token rafraîchi avec succès.' /* access_token: access_token */ });

  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token:', error.response?.data || error.message);

    // Si le refresh token est invalide (souvent erreur 400 ou 401 de l'oauth provider)
    if (axios.isAxiosError(error) && (error.response?.status === 400 || error.response?.status === 401)) {
      clearTokens(); // Effacer les anciens tokens car le refresh token est invalide
      return res.status(error.response.status).json({
        message: 'Impossible de rafraîchir le token. Le refresh token est peut-être invalide ou révoqué. Veuillez vous réauthentifier.',
        error: error.response.data,
        redirectTo: '/auth/raindrop/login'
      });
    }

    return res.status(500).json({
        message: 'Erreur interne du serveur lors du rafraîchissement du token.',
        error: error.response?.data || error.message
    });
  }
};
