import { validTransaction } from '../frontend/js/domain/validation.js';
export function validDocument(document) {
  if (!document || !Array.isArray(document.transactions)) return false;
  const categories = document.customCategories ?? [];
  if (!Array.isArray(categories) || !categories.every(c => typeof c === 'string' || c && typeof c.name === 'string')) return false;
  const ids = new Set();
  return document.transactions.every(item => {
    if (!validTransaction(item) || ids.has(String(item.id))) return false;
    ids.add(String(item.id));
    return true;
  });
}
