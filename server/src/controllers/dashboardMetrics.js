export function sumPaymentAggregation(rows = []) {
  const total = rows.reduce((sum, row) => sum + Number(row?.total || 0), 0);
  return Math.round(total * 100) / 100;
}
