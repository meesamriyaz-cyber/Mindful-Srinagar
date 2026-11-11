export function calculateOutstandingBalance(invoices = []) {
  return invoices.reduce((sum, invoice) => {
    const subtotal = (invoice.items || []).reduce(
      (itemSum, item) => itemSum + Number(item.quantity || 0) * Number(item.rate || 0), 0
    );
    return sum + Math.max(subtotal - Number(invoice.discount || 0) - Number(invoice.paidAmount || 0), 0);
  }, 0);
}
