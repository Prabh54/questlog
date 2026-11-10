/**
 * Writes bench/out/tokens.json: access tokens for every bench user, signed
 * the same way the API signs them (src/lib/tokens.ts), so the load test can
 * skip logging in. They are valid for 3 hours instead of 15 minutes.
 *
 *   BENCH_JWT_SECRET=... node bench/mint-tokens.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const secret = process.env.BENCH_JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('Set BENCH_JWT_SECRET (≥ 32 chars)');

const POWER_USERS = 100; // bench-user-1..100 have 3 years of history (see seed.sql)
const TOTAL_USERS = 2000;

function mint(n) {
  return {
    userId: `bench-user-${n}`,
    // first DAILY quest of the user, for the quest-detail page
    questId: `bench-quest-${n}-1`,
    token: jwt.sign({ email: `bench${n}@questlog.test`, sid: 'bench' }, secret, {
      algorithm: 'HS256',
      subject: `bench-user-${n}`,
      issuer: 'questlog-api',
      audience: 'questlog',
      expiresIn: '3h',
    }),
  };
}

const users = Array.from({ length: TOTAL_USERS }, (_, i) => mint(i + 1));
const out = path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, 'tokens.json'),
  JSON.stringify({ power: users.slice(0, POWER_USERS), casual: users.slice(POWER_USERS) }),
);
console.log(`minted ${users.length} tokens → bench/out/tokens.json`);
