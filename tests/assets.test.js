import test from 'node:test';
import assert from 'node:assert/strict';
import { win32, posix } from 'node:path';
import { assetUrl } from '../backend/assets.js';

test('Windows assets use URL separators for CSS, JS and nested imports', () => {
  const root = 'C:\\projetos\\app-financas\\frontend';
  for (const asset of ['styles/main.css', 'styles/base.css', 'js/app.js', 'js/domain/installments.js']) {
    assert.equal(assetUrl(root, win32.join(root, asset), win32), '/' + asset);
  }
});
test('Linux assets keep the same public URLs', () => {
  const root = '/workspace/app-financas/frontend';
  assert.equal(assetUrl(root, posix.join(root, 'styles/main.css'), posix), '/styles/main.css');
});
