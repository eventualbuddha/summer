import type { AmountFilter } from '$lib/types';

export function parseAmountInput(raw: string): AmountFilter | null {
	let s = raw.trim();
	if (!s) return null;

	// Strip optional leading $
	if (s.startsWith('$')) s = s.slice(1);

	// Approx: ~ then optional $
	if (s.startsWith('~')) {
		let rest = s.slice(1);
		if (rest.startsWith('$')) rest = rest.slice(1);
		if (rest === '') return null;
		const value = parseFloat(rest);
		if (!isNaN(value) && isFinite(value)) {
			return { op: 'approx', value: Math.round(value * 100) };
		}
		return null;
	}

	// Less than: < then optional $
	if (s.startsWith('<')) {
		let rest = s.slice(1);
		if (rest.startsWith('$')) rest = rest.slice(1);
		if (rest === '') return null;
		const value = parseFloat(rest);
		if (!isNaN(value) && isFinite(value)) {
			return { op: 'lt', value: Math.round(value * 100) };
		}
		return null;
	}

	// Greater than: > then optional $
	if (s.startsWith('>')) {
		let rest = s.slice(1);
		if (rest.startsWith('$')) rest = rest.slice(1);
		if (rest === '') return null;
		const value = parseFloat(rest);
		if (!isNaN(value) && isFinite(value)) {
			return { op: 'gt', value: Math.round(value * 100) };
		}
		return null;
	}

	// Range: N-M (both must be non-negative numbers)
	const rangeMatch = s.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
	if (rangeMatch) {
		const min = Math.round(parseFloat(rangeMatch[1]!) * 100);
		const max = Math.round(parseFloat(rangeMatch[2]!) * 100);
		if (!isNaN(min) && !isNaN(max)) {
			return { op: 'range', min, max };
		}
	}

	// Plain number
	if (/^\d+(?:\.\d+)?$/.test(s)) {
		const value = parseFloat(s);
		if (!isNaN(value)) {
			return { op: 'exact', value: Math.round(value * 100) };
		}
	}

	return null;
}
