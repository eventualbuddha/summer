export interface Selection<T> {
	value: T;
	key: string;
	selected: boolean;
}

export type AmountFilter =
	| { op: 'exact'; value: number }
	| { op: 'approx'; value: number }
	| { op: 'lt'; value: number }
	| { op: 'gt'; value: number }
	| { op: 'range'; min: number; max: number };

export type SearchFilter =
	| { type: 'tag'; value: string }
	| { type: 'amount'; filter: AmountFilter }
	| { type: 'desc'; value: string }
	| { type: 'bank'; value: string };

export function formatAmountCents(cents: number): string {
	const dollars = cents / 100;
	if (dollars % 1 === 0) return String(dollars);
	return dollars.toFixed(2).replace(/0+$/, '');
}

export function searchFilterLabel(f: SearchFilter): string {
	switch (f.type) {
		case 'tag':
			return f.value;
		case 'desc':
			return `desc:${f.value}`;
		case 'bank':
			return `bank:${f.value}`;
		case 'amount': {
			const af = f.filter;
			switch (af.op) {
				case 'exact':
					return `$${formatAmountCents(af.value)}`;
				case 'approx':
					return `~$${formatAmountCents(af.value)}`;
				case 'lt':
					return `<$${formatAmountCents(af.value)}`;
				case 'gt':
					return `>$${formatAmountCents(af.value)}`;
				case 'range':
					return `$${formatAmountCents(af.min)}–$${formatAmountCents(af.max)}`;
			}
		}
	}
}
