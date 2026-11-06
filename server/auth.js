// Sign in with Google / Apple: verify the provider's ID token (RS256 JWT) against its published
// keys, with no dependencies. Enabled only when the client IDs are configured:
//   GOOGLE_CLIENT_ID   OAuth client ID (Google Cloud Console → Credentials → Web application)
//   APPLE_CLIENT_ID    Services ID (Apple Developer → Identifiers), APPLE_REDIRECT_URI (HTTPS, registered)
import crypto from 'node:crypto';

export class AuthError extends Error {}

export const PROVIDERS = {
  google: { issuers: ['https://accounts.google.com', 'accounts.google.com'], jwks: 'https://www.googleapis.com/oauth2/v3/certs', clientId: () => process.env.GOOGLE_CLIENT_ID },
  apple: { issuers: ['https://appleid.apple.com'], jwks: 'https://appleid.apple.com/auth/keys', clientId: () => process.env.APPLE_CLIENT_ID },
};

export function authConfig() {
  return {
    google: process.env.GOOGLE_CLIENT_ID ? { clientId: process.env.GOOGLE_CLIENT_ID } : null,
    apple: process.env.APPLE_CLIENT_ID && process.env.APPLE_REDIRECT_URI
      ? { clientId: process.env.APPLE_CLIENT_ID, redirectUri: process.env.APPLE_REDIRECT_URI } : null,
  };
}

const keyCache = new Map(); // url -> { at, keys }
async function fetchJwks(url) {
  const hit = keyCache.get(url);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.keys;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new AuthError('Could not reach the sign-in provider.');
  const { keys } = await res.json();
  keyCache.set(url, { at: Date.now(), keys });
  return keys;
}

const b64url = (s) => Buffer.from(s, 'base64url');

/**
 * Verify an ID token. Returns { sub, email, name }.
 * opts.getKeys(url) and opts.now are for tests.
 */
export async function verifyIdToken(provider, token, { getKeys = fetchJwks, now = Date.now(), clientId } = {}) {
  const p = PROVIDERS[provider];
  if (!p) throw new AuthError('Unknown sign-in provider.');
  const aud = clientId ?? p.clientId();
  if (!aud) throw new AuthError(`${provider} sign-in isn't set up on this server.`);
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new AuthError('Sign-in token is malformed.');
  let header, payload;
  try { header = JSON.parse(b64url(parts[0])); payload = JSON.parse(b64url(parts[1])); } catch { throw new AuthError('Sign-in token is malformed.'); }
  if (header.alg !== 'RS256') throw new AuthError('Unexpected token algorithm.');
  let jwk = (await getKeys(p.jwks)).find((k) => k.kid === header.kid);
  if (!jwk) { keyCache.delete(p.jwks); jwk = (await getKeys(p.jwks)).find((k) => k.kid === header.kid); }
  if (!jwk) throw new AuthError('Unknown signing key.');
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, b64url(parts[2]));
  if (!ok) throw new AuthError('Sign-in token signature is invalid.');
  const t = Math.floor(now / 1000);
  if (!p.issuers.includes(payload.iss)) throw new AuthError('Sign-in token is from the wrong issuer.');
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new AuthError('Sign-in token is for a different app.');
  if (!(payload.exp > t - 60)) throw new AuthError('Sign-in expired. Try again.');
  if (payload.iat && payload.iat > t + 300) throw new AuthError('Sign-in token is not valid yet.');
  if (!payload.sub) throw new AuthError('Sign-in token has no account id.');
  return { sub: String(payload.sub), email: payload.email || null, name: payload.given_name || payload.name || null };
}
