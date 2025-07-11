import { storeTokens, getTokens, clearTokens, getAccessToken, getRefreshToken } from '../token.store';

// Helper pour avancer dans le temps avec Jest
const advanceTimersByTime = (ms: number) => {
  jest.advanceTimersByTime(ms);
};

describe('TokenStore', () => {
  beforeEach(() => {
    // S'assurer que les tokens sont effacés avant chaque test
    clearTokens();
    // Utiliser les fake timers de Jest pour contrôler Date.now()
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Restaurer les timers réels après chaque test
    jest.useRealTimers();
  });

  it('should initially return null for all token getters', () => {
    expect(getTokens()).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('should store and retrieve tokens correctly', () => {
    const tokens = {
      access_token: 'test_access_token',
      refresh_token: 'test_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer',
    };
    const currentTime = Date.now();
    jest.setSystemTime(currentTime);

    storeTokens(tokens);

    const stored = getTokens();
    expect(stored).toEqual({
      ...tokens,
      obtained_at: Math.floor(currentTime / 1000),
    });
    expect(getAccessToken()).toBe('test_access_token');
    expect(getRefreshToken()).toBe('test_refresh_token');
  });

  it('should clear tokens correctly', () => {
    storeTokens({ access_token: 'temp_token' });
    expect(getTokens()).not.toBeNull();
    clearTokens();
    expect(getTokens()).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('getAccessToken should return null if tokens are stored but access_token is expired', () => {
    const tokens = {
      access_token: 'expired_access_token',
      refresh_token: 'any_refresh_token',
      expires_in: 3600, // 1 heure
      obtained_at: Math.floor(Date.now() / 1000) - 3601, // expiré depuis 1 seconde
    };

    // Simuler le stockage de ce token (en contournant le obtained_at automatique de storeTokens pour ce test)
    jest.spyOn(global.Date, 'now').mockReturnValue( (tokens.obtained_at + tokens.expires_in + 1) * 1000 );

    // Pour ce test spécifique, nous allons "manuellement" mettre les données dans le store
    // car storeTokens met à jour obtained_at.
    // Ceci est une façon de le faire, une autre serait de mocker Date.now() avant d'appeler storeTokens.
    let internalTokenData = null;
    jest.isolateModules(() => {
        const tokenStore = require('../token.store');
        tokenStore.storeTokens({ // Appel initial pour remplir la structure
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in
        });
        // Forcer la valeur de obtained_at pour le test d'expiration
        const currentStoredTokens = tokenStore.getTokens();
        if(currentStoredTokens) {
            currentStoredTokens.obtained_at = tokens.obtained_at;
        }
        internalTokenData = currentStoredTokens;
    });

    // Rétablir Date.now pour que getAccessToken() le voie comme "maintenant"
    jest.setSystemTime((tokens.obtained_at + tokens.expires_in + 1) * 1000);

    // Récupérer via la fonction getAccessToken() qui contient la logique d'expiration
    // Cette partie est délicate à cause de l'isolation du module et du state interne.
    // Un refactor du token.store pour permettre l'injection de Date.now serait plus testable.
    // Pour l'instant, on va se fier à la logique interne de getAccessToken.
    // Si on avait injecté Date.now dans le store, on aurait pu le contrôler plus facilement.

    // Appelons storeTokens avec le temps initial correct
    jest.setSystemTime( (tokens.obtained_at - 10) * 1000); // Un peu avant l'obtention pour que obtained_at soit correct
     storeTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    });
    // Forcer la valeur de obtained_at pour le test d'expiration
     const stored = getTokens();
     if (stored && stored.obtained_at) {
        // Forcer l'heure d'obtention pour qu'elle corresponde à notre scénario "expiré"
        (stored as any).obtained_at = tokens.obtained_at;
     }

    // Avancer le temps pour que le token soit expiré
    advanceTimersByTime((tokens.expires_in + 5) * 1000); // Avancer de plus que expires_in

    expect(getAccessToken()).toBeNull();
  });

  it('getAccessToken should return the token if it is not expired', () => {
    const tokens = {
      access_token: 'valid_access_token',
      expires_in: 3600,
    };
    const currentTime = Date.now();
    jest.setSystemTime(currentTime);
    storeTokens(tokens);

    // Avancer le temps mais pas assez pour expirer
    advanceTimersByTime(1800 * 1000); // 30 minutes

    expect(getAccessToken()).toBe('valid_access_token');
  });
});
