import { Router } from 'express';
import {
  redirectToRaindrop,
  handleRaindropCallback,
  getUserCollections,
  refreshToken, // Importer la fonction de rafraîchissement
} from './raindrop.controller';

const router = Router();

// Route pour initier le flux OAuth et rediriger vers Raindrop
router.get('/login', redirectToRaindrop);

// Route pour gérer le callback de Raindrop après autorisation
router.get('/callback', handleRaindropCallback);

// Route d'exemple pour appeler l'API Raindrop (récupérer les collections)
router.get('/collections', getUserCollections);

// Route pour rafraîchir le token
router.post('/refresh-token', refreshToken); // Souvent POST car cela modifie l'état du token

export default router;
