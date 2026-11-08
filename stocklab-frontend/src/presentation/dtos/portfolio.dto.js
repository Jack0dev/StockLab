/**
 * Presentation DTO: Portfolio DTO
 * Formats and maps portfolio data for UI presentation.
 */

export function toPortfolioViewModel(portfolio) {
  if (!portfolio) return null;
  return {
    ...portfolio,
    displayName: portfolio.name,
    isDefault: portfolio.isDefault ?? false,
    stockCount: portfolio.stocks?.length || 0,
    formattedCreatedAt: portfolio.createdAt ? new Date(portfolio.createdAt).toLocaleDateString('vi-VN') : '',
  };
}
