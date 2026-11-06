// ID-token verification with a locally generated key pair and a fake JWKS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyIdToken } from './auth.js';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const getKeys = async () => [jwk];
const now = Date.now(), t = Math.floor(now / 1000);

function sign(payload, header = { alg: 'RS256', kid: 'k1', typ: 'JWT' }, key = privateKey) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = `${enc(header)}.${enc(payload)}`;
  return `${data}.${crypto.sign('RSA-SHA256', Buffer.from(data), key).toString('base64url')}`;
}
const good = { iss: 'https://accounts.google.com', aud: 'client-1', sub: '123', email: 'sam@example.com', given_name: 'Sam', iat: t, exp: t + 3600 };
const opts = { getKeys, now, clientId: 'client-1' };

test('accepts a valid Google token', async () => {
  assert.deepEqual(await verifyIdToken('google', sign(good), opts), { sub: '123', email: 'sam@example.com', name: 'Sam' });
});

test('accepts a valid Apple token', async () => {
  const r = await verifyIdToken('apple', sign({ ...good, iss: 'https://appleid.apple.com' }), opts);
  assert.equal(r.sub, '123');
});

test('rejects wrong audience, issuer, expiry, signature and algorithm', async () => {
  await assert.rejects(verifyIdToken('google', sign({ ...good, aud: 'other' }), opts), /different app/);
  await assert.rejects(verifyIdToken('google', sign({ ...good, iss: 'https://evil.example' }), opts), /wrong issuer/);
  await assert.rejects(verifyIdToken('google', sign({ ...good, exp: t - 3600 }), opts), /expired/);
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await assert.rejects(verifyIdToken('google', sign(good, undefined, other), opts), /signature/);
  await assert.rejects(verifyIdToken('google', sign(good, { alg: 'none', kid: 'k1' }), opts), /algorithm/);
});

test('refuses when the provider is not configured', async () => {
  await assert.rejects(verifyIdToken('google', sign(good), { getKeys, now, clientId: '' }), /isn't set up/);
});
