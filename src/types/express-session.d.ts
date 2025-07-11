import 'express-session';

declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
    // Potentiellement, nous pourrions aussi stocker les tokens ici si nous adoptions une stratégie de session
    // accessToken?: string;
    // refreshToken?: string;
  }
}
