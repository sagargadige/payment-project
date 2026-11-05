/** Format an amount stored in cents as a currency string. */
export function formatMoney(cents, currency = 'USD') {
  const value = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Format an ISO date string for display. */
export function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Short human-readable id (last 8 chars). */
export function shortId(id) {
  if (!id) return '—';
  return String(id).slice(-8).toUpperCase();
}
