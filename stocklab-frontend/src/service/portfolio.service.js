/**
 * Service Layer — Portfolio Business Logic
 * Chứa logic tính toán hiệu suất sinh lời, cơ cấu tỷ trọng và biểu đồ
 * 100% Pure Functions — Độc lập với UI và Framework
 */

export { formatPrice, formatPercent } from '@/domain/utils/formatter.js';
import { formatPrice } from '@/domain/utils/formatter.js';

export function calculateAllMetrics(portfolio = [], balance = 0) {
  const totalValue = portfolio.reduce((sum, p) => sum + Number(p.totalValue || 0), 0);
  const totalInvested = portfolio.reduce(
    (sum, p) => sum + (Number(p.avgBuyPrice || 0) * Number(p.quantity || 0)),
    0
  );
  const totalPnL = portfolio.reduce((sum, p) => sum + Number(p.profitLoss || 0), 0);
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const totalAssets = totalValue + Number(balance || 0);

  return {
    totalValue,
    totalInvested,
    totalPnL,
    totalPnLPercent,
    totalAssets,
  };
}

export function buildDonutChartData(allocations = []) {
  if (!allocations || allocations.length === 0) return null;

  const validData = allocations.map((a) => Math.max(0, Number(a.value) || 0));
  const hasValue = validData.some((v) => v > 0);

  return {
    labels: allocations.map((a) => a.ticker),
    datasets: [
      {
        data: hasValue ? validData : allocations.map(() => 1),
        backgroundColor: allocations.map((a) => a.color || '#2563eb'),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };
}

export function getDonutChartOptions(allocations = []) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#090d16',
        titleFont: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          size: 12,
          weight: 'bold',
        },
        bodyFont: {
          family: "'JetBrains Mono', 'Fira Code', monospace",
          size: 11,
        },
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: (ctx) => {
            const alloc = allocations[ctx.dataIndex];
            if (!alloc) return '';
            const val = Number(alloc.value) || 0;
            const pct = Number(alloc.percentage) || 0;
            return ` ${alloc.ticker}: ${formatPrice(val)} ₫ (${pct.toFixed(1)}%)`;
          },
        },
      },
    },
  };
}
