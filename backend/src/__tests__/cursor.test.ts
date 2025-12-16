import { encodeCursor, decodeCursor } from '../utils/cursor';

describe('cursor encode/decode', () => {
  it('round-trips a {completedAt, id} payload', () => {
    const completedAt = new Date('2026-05-15T12:34:56.789Z');
    const id = 'ckxyz1234567890';
    const token = encodeCursor({ completedAt, id });

    const decoded = decodeCursor(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(id);
    expect(decoded!.completedAt.toISOString()).toBe(completedAt.toISOString());
  });

  it('produces URL-safe base64 (no + / =)', () => {
    const token = encodeCursor({
      completedAt: new Date('2026-01-01T00:00:00Z'),
      id: 'abc',
    });
    expect(token).not.toMatch(/[+/=]/);
  });

  it('returns null for malformed cursors', () => {
    expect(decodeCursor('not-base64!@#$%')).toBeNull();
    expect(decodeCursor('aGVsbG8=')).toBeNull(); // "hello", not JSON
    expect(decodeCursor(Buffer.from('{"foo":"bar"}').toString('base64url'))).toBeNull();
  });

  it('rejects an invalid ISO date', () => {
    const token = Buffer.from(
      JSON.stringify({ completedAt: 'not-a-date', id: 'abc' }),
      'utf-8',
    ).toString('base64url');
    expect(decodeCursor(token)).toBeNull();
  });
});
