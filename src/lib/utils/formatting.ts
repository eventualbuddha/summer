export function formatTransactionAmount(cents: number): string {
	return `${cents <= 0 ? '' : '+'}${(Math.abs(cents) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
}

export function formatWholeDollarAmount(cents: number): string {
	return `${cents <= 0 ? '' : '+'}${(Math.abs(cents) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`;
}
