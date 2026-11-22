import { OAuth2Client } from 'google-auth-library';
import { HttpError } from '../utils/http.js';

let customOAuthClient = null;

export function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
}

export function setGoogleAuthClient(client) {
  customOAuthClient = client;
}

export function resetGoogleAuthClient() {
  customOAuthClient = null;
}

export function getOAuth2Client() {
  if (customOAuthClient) return customOAuthClient;
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new HttpError(503, 'Google sign-in is not configured on the server. Set GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID.');
  }
  return new OAuth2Client(clientId);
}

export async function verifyGoogleIdToken(idToken, clientOverride = null) {
  if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
    throw new HttpError(400, 'A valid Google ID token is required.');
  }

  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new HttpError(503, 'Google sign-in is not configured on the server. Set GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID.');
  }

  const client = clientOverride || getOAuth2Client();

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: idToken.trim(),
      audience: clientId
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(401, 'Invalid or expired Google authentication token.');
  }

  const payload = ticket?.getPayload ? ticket.getPayload() : ticket?.payload;
  if (!payload) {
    throw new HttpError(401, 'Google authentication failed: empty token payload.');
  }

  // Audience validation against configured client ID
  if (payload.aud !== clientId) {
    throw new HttpError(401, 'Google token audience does not match the configured client ID.');
  }

  // Issuer validation: accounts.google.com or https://accounts.google.com
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
    throw new HttpError(401, 'Google token issuer is invalid.');
  }

  // Token expiration validation
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new HttpError(401, 'Google token has expired. Please sign in again.');
  }

  // Email verification check
  if (!payload.email_verified) {
    throw new HttpError(403, 'Your Google email address must be verified with Google before signing in.');
  }

  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  if (!email) {
    throw new HttpError(400, 'Google token does not contain a valid email address.');
  }

  return {
    googleId: payload.sub,
    email,
    name: payload.name || payload.given_name || email.split('@')[0],
    picture: payload.picture || null
  };
}
