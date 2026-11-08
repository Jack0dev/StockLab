/**
 * Domain Entity: Portfolio
 * Defines core rules, types, and metric structures for portfolios.
 */

export const ASSET_TYPES = {
  CASH: 'CASH',
  STOCK: 'STOCK',
};

export const DEFAULT_PORTFOLIO_ID = 'default';

/**
 * Validates custom portfolio creation/update parameters.
 */
export function validatePortfolioInput({ name, description }) {
  if (!name || name.trim().length === 0) {
    return { valid: false, message: 'Tên danh mục không được để trống.' };
  }
  if (name.trim().length > 100) {
    return { valid: false, message: 'Tên danh mục không được vượt quá 100 ký tự.' };
  }
  return { valid: true };
}
