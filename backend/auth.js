import { createHash, timingSafeEqual } from 'node:crypto';
export function authenticated(header, username, password) {
  if (!password) return true;
  const expected = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(header || ''), digest(expected));
}
