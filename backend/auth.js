import { createHash, timingSafeEqual } from 'node:crypto';
const digest = value => createHash('sha256').update(value).digest();
export function credentialsMatch(actualUser, actualPassword, username, password) {
  return timingSafeEqual(digest(JSON.stringify([actualUser, actualPassword])), digest(JSON.stringify([username, password])));
}
export function credentialVersion(username, password) {
  return digest(JSON.stringify([username, password])).toString('hex');
}
