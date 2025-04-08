import type { Page, PageText } from './page';
import type { Statement } from './Statement';

export class StatementNavigator {
	readonly #statement: Statement;

	constructor(statement: Statement) {
		this.#statement = statement;
	}

	find(finder: Finder): StatementTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		for (let i = 0; i < this.#statement.pages.length; i += 1) {
			const page = this.#statement.pages[i]!;
			const location = page.navigator.find(predicate);
			if (!location) continue;
			return new StatementTextLocation(this.#statement.pages, page.pageNumber, location, this);
		}
	}

	*findAll(finder: Finder): Generator<StatementTextLocation> {
		const predicate = predicateForFinder(finder);
		for (let i = 0; i < this.#statement.pages.length; i += 1) {
			const page = this.#statement.pages[i]!;
			for (const pageLocation of page.navigator.findAll(predicate)) {
				yield new StatementTextLocation(this.#statement.pages, page.pageNumber, pageLocation, this);
			}
		}
	}

	getPage(pageNumber: number): PageNavigator | undefined {
		return this.#statement.pages.find((page) => page.pageNumber === pageNumber)?.navigator;
	}
}

export class StatementTextLocation {
	readonly #pages: readonly Page[];
	readonly #pageNumber: number;
	readonly #pageLocation: PageTextLocation;
	readonly #navigator: StatementNavigator;

	constructor(
		pages: readonly Page[],
		pageNumber: number,
		pageLocation: PageTextLocation,
		navigator: StatementNavigator
	) {
		this.#pages = pages;
		this.#pageNumber = pageNumber;
		this.#pageLocation = pageLocation;
		this.#navigator = navigator;
	}

	get text(): PageText {
		return this.#pageLocation.text;
	}

	get pageNumber(): number {
		return this.#pageNumber;
	}

	get pageLocation(): PageTextLocation {
		return this.#pageLocation;
	}

	get index(): number {
		return this.#pageLocation.index;
	}

	isAbove(other: StatementTextLocation): boolean {
		return this.#pageNumber === other.#pageNumber
			? this.#pageLocation.isAbove(other.pageLocation)
			: this.#pageNumber < other.#pageNumber;
	}

	isBelow(other: StatementTextLocation): boolean {
		return this.#pageNumber === other.#pageNumber
			? this.#pageLocation.isBelow(other.pageLocation)
			: this.#pageNumber > other.#pageNumber;
	}

	findRight(finder: Finder): StatementTextLocation | undefined {
		const pageLocation = this.#pageLocation.findRight(finder);
		return pageLocation
			? new StatementTextLocation(this.#pages, this.#pageNumber, pageLocation, this.#navigator)
			: undefined;
	}

	findLeft(finder: Finder): StatementTextLocation | undefined {
		const pageLocation = this.#pageLocation.findLeft(finder);
		return pageLocation
			? new StatementTextLocation(this.#pages, this.#pageNumber, pageLocation, this.#navigator)
			: undefined;
	}

	findDown(
		finder: Finder,
		{ alignment, maxGap }: { alignment: Alignment; maxGap?: number }
	): StatementTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		const pageLocation = this.#pageLocation.findDown(predicate, { alignment, maxGap });

		if (pageLocation) {
			return new StatementTextLocation(
				this.#pages,
				this.#pageNumber,
				pageLocation,
				this.#navigator
			);
		}

		if (typeof maxGap === 'number') {
			return undefined;
		}

		const pageIndex = this.#pages.findIndex((p) => p.pageNumber === this.#pageNumber);

		for (let i = pageIndex + 1; i < this.#pages.length; i += 1) {
			const page = this.#pages[i]!;
			const pageLocation = page.navigator.find(
				(text) =>
					predicate(text) &&
					text.isVerticallyAlignedWith(this.text, {
						alignment,
						maxGap
					})
			);

			if (pageLocation) {
				return new StatementTextLocation(
					this.#pages,
					page.pageNumber,
					pageLocation,
					this.#navigator
				);
			}
		}

		return undefined;
	}

	findBefore(finder: Finder): StatementTextLocation | undefined {
		const pageLocation = this.#pageLocation.findBefore(finder);

		if (pageLocation) {
			return new StatementTextLocation(
				this.#pages,
				this.#pageNumber,
				pageLocation,
				this.#navigator
			);
		}

		for (let i = this.#pageNumber - 1; i >= 0; i--) {
			const page = this.#navigator.getPage(i)!;
			const pageLocation = page.findLast(finder);

			if (pageLocation) {
				return new StatementTextLocation(this.#pages, i, pageLocation, this.#navigator);
			}
		}

		return undefined;
	}

	findAfter(finder: Finder): StatementTextLocation | undefined {
		const pageLocation = this.#pageLocation.findAfter(finder);

		if (pageLocation) {
			return new StatementTextLocation(
				this.#pages,
				this.#pageNumber,
				pageLocation,
				this.#navigator
			);
		}

		for (let i = this.#pageNumber + 1; ; i++) {
			const page = this.#navigator.getPage(i);
			if (!page) break;

			const pageLocation = page.find(finder);

			if (pageLocation) {
				return new StatementTextLocation(this.#pages, i, pageLocation, this.#navigator);
			}
		}

		return undefined;
	}

	[Symbol.for('nodejs.util.inspect.custom')]() {
		return `StatementTextLocation { text: ${this.text.str}, pageNumber: ${this.#pageNumber}, x=${this.text.x}, y=${this.text.y} }`;
	}
}

/**
 * Finds text within the page.
 */
export class PageNavigator {
	readonly #page: Page;

	constructor(page: Page) {
		this.#page = page;
	}

	/**
	 * Finds text using `finder`, which can be a string, regular expression,
	 * or a custom predicate function.
	 *
	 * @example
	 *
	 * ```ts
	 * const helloLabel = page.navigator.find('Hello');
	 * const accountLabel = page.navigator.find(/Account: \d+/);
	 * ```
	 */
	find(finder: Finder): PageTextLocation | undefined {
		return this.findAll(finder).next().value;
	}

	*findAll(finder: Finder): Generator<PageTextLocation> {
		const predicate = predicateForFinder(finder);
		for (const [index, text] of this.#page.texts.entries()) {
			if (predicate(text)) {
				yield new PageTextLocation(text, this.#page.pageNumber, index, this);
			}
		}
	}

	findLast(finder: Finder): PageTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		for (let index = this.#page.texts.length - 1; index >= 0; index -= 1) {
			if (predicate(this.#page.texts[index]!)) {
				return new PageTextLocation(this.#page.texts[index]!, this.#page.pageNumber, index, this);
			}
		}
		return undefined;
	}

	findScored(scorer: Scorer): { location: PageTextLocation; score: number } | undefined {
		const scored = this.#page.texts.map((text, index) => ({
			location: new PageTextLocation(text, this.#page.pageNumber, index, this),
			score: scorer(text)
		}));

		let bestScore = Infinity;
		let bestLocation: PageTextLocation | undefined;
		for (const { location, score } of scored) {
			if (score < bestScore) {
				bestScore = score;
				bestLocation = location;
			}
		}
		if (bestLocation) {
			return { location: bestLocation, score: bestScore };
		}
	}

	/**
	 * Finds text before the given index using `finder`, which can be a string,
	 * regular expression, or a custom predicate function.
	 */
	findBefore(beforeIndex: number, finder: Finder): PageTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		for (let index = beforeIndex - 1; index >= 0; index -= 1) {
			if (predicate(this.#page.texts[index]!)) {
				return new PageTextLocation(this.#page.texts[index]!, this.#page.pageNumber, index, this);
			}
		}
		return undefined;
	}

	/**
	 * Finds text after the given index using `finder`, which can be a string,
	 * regular expression, or a custom predicate function.
	 */
	findAfter(afterIndex: number, finder: Finder): PageTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		for (let index = afterIndex + 1; index < this.#page.texts.length; index += 1) {
			if (predicate(this.#page.texts[index]!)) {
				return new PageTextLocation(this.#page.texts[index]!, this.#page.pageNumber, index, this);
			}
		}
		return undefined;
	}
}

interface FindTableOptions {
	labelAlignment: Alignment;
	valueAlignment: Alignment;
	maxGap?: number;
}

type N<Count extends number, T> = Count extends 0
	? []
	: Count extends 1
		? [T]
		: Count extends 2
			? [T, T]
			: Count extends 3
				? [T, T, T]
				: Count extends 4
					? [T, T, T, T]
					: Count extends 5
						? [T, T, T, T, T]
						: Count extends 6
							? [T, T, T, T, T, T]
							: Count extends 7
								? [T, T, T, T, T, T, T]
								: Count extends 8
									? [T, T, T, T, T, T, T, T]
									: Count extends 9
										? [T, T, T, T, T, T, T, T, T]
										: Count extends 10
											? [T, T, T, T, T, T, T, T, T, T]
											: Count extends 11
												? [T, T, T, T, T, T, T, T, T, T, T]
												: T[];

/**
 * Finds nearby text elements.
 */
export class PageTextLocation {
	readonly #text: PageText;
	readonly #pageNumber: number;
	readonly #index: number;
	readonly #navigator: PageNavigator;

	constructor(text: PageText, pageNumber: number, index: number, navigator: PageNavigator) {
		this.#text = text;
		this.#pageNumber = pageNumber;
		this.#index = index;
		this.#navigator = navigator;
	}

	get text(): PageText {
		return this.#text;
	}

	get index(): number {
		return this.#index;
	}

	get pageNumber(): number {
		return this.#pageNumber;
	}

	get centerX(): number {
		return this.#text.x + this.#text.width / 2;
	}

	get centerY(): number {
		return this.#text.y + this.#text.height / 2;
	}

	isAbove(other: PageTextLocation): boolean {
		return this.pageNumber < other.#pageNumber || this.centerY > other.centerY;
	}

	isBelow(other: PageTextLocation): boolean {
		return this.pageNumber > other.#pageNumber || this.centerY < other.centerY;
	}

	/**
	 * Finds a text element to the right of the current text element.
	 */
	findRight(
		finder: Finder,
		{
			maxHorizontalError = Infinity,
			maxVerticalError = 5
		}: { maxHorizontalError?: number; maxVerticalError?: number } = {}
	): PageTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		const bestX = this.#text.right;
		const bestY = this.#text.centerY;

		const scoredLocation = this.#navigator.findScored((text) => {
			if (!predicate(text) || text === this.#text) {
				return Infinity;
			}

			const verticalError = Math.abs(text.centerY - bestY);
			if (verticalError > maxVerticalError) {
				return Infinity;
			}

			if (text.right < bestX) {
				return Infinity;
			}

			const horizontalError = Math.abs(text.x - bestX);
			if (horizontalError > maxHorizontalError) {
				return Infinity;
			}

			return horizontalError ** (bestX <= text.x ? 0.5 : 2) + verticalError ** 2;
		});

		return scoredLocation?.location;
	}

	/**
	 * Finds a text element to the left of the current text element.
	 */
	findLeft(
		finder: Finder,
		{
			maxHorizontalError = Infinity,
			maxVerticalError = 5
		}: { maxHorizontalError?: number; maxVerticalError?: number } = {}
	): PageTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		const bestRight = this.#text.x;
		const bestCenterY = this.#text.centerY;

		const scoredLocation = this.#navigator.findScored((text) => {
			if (!predicate(text) || text === this.#text) {
				return Infinity;
			}

			const verticalError = Math.abs(text.centerY - bestCenterY);
			if (verticalError > maxVerticalError) {
				return Infinity;
			}

			const horizontalError = Math.abs(text.x + text.width - bestRight);
			if (horizontalError > maxHorizontalError) {
				return Infinity;
			}

			return horizontalError ** (bestRight >= text.x + text.width ? 0.5 : 2) + verticalError ** 2;
		});

		return scoredLocation?.location;
	}

	/**
	 * Finds a text element aligned below the current text element.
	 */
	findDown(
		finder: Finder,
		{ alignment, maxGap }: { alignment: Alignment; maxGap?: number }
	): PageTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		const maxY = this.#text.bottom;
		return this.#navigator.find(
			(text) =>
				text.top <= maxY + 1 &&
				predicate(text) &&
				text.isVerticallyAlignedWith(this.#text, { alignment, maxGap })
		);
	}

	/**
	 * Finds a text element aligned above the current text element.
	 */
	findUp(
		finder: Finder,
		{ alignment, maxGap }: { alignment: Alignment; maxGap?: number }
	): PageTextLocation | undefined {
		const predicate = predicateForFinder(finder);
		const minY = this.#text.y + this.#text.height;
		return this.#navigator.find(
			(text) =>
				text.y >= minY - 1 &&
				predicate(text) &&
				text.isVerticallyAlignedWith(this.#text, { alignment, maxGap })
		);
	}

	findBefore(finder: Finder): PageTextLocation | undefined {
		return this.#navigator.findBefore(this.#index, finder);
	}

	findAfter(finder: Finder): PageTextLocation | undefined {
		return this.#navigator.findAfter(this.#index, finder);
	}

	findColumn(
		finder: Finder,
		options: { alignment: Alignment; maxGap?: number }
	): PageTextLocation[] {
		const predicate = predicateForFinder(finder);
		const locations: PageTextLocation[] = [];

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let last: PageTextLocation = this;

		while (true) {
			const next = last.findDown(predicate, options);
			if (!next) break;
			locations.push(next);
			last = next;
		}

		return locations;
	}

	findTable(labels: [], values: [], options: FindTableOptions): [] | undefined;
	findTable(
		labels: [Finder],
		values: [Finder],
		options: FindTableOptions
	): [[PageTextLocation, PageTextLocation]] | undefined;
	findTable(
		labels: N<2, Finder>,
		values: N<2, Finder>,
		options: FindTableOptions
	): N<2, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<3, Finder>,
		values: N<3, Finder>,
		options: FindTableOptions
	): N<3, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<4, Finder>,
		values: N<4, Finder>,
		options: FindTableOptions
	): N<4, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<5, Finder>,
		values: N<5, Finder>,
		options: FindTableOptions
	): N<5, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<6, Finder>,
		values: N<6, Finder>,
		options: FindTableOptions
	): N<6, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<7, Finder>,
		values: N<7, Finder>,
		options: FindTableOptions
	): N<7, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<8, Finder>,
		values: N<8, Finder>,
		options: FindTableOptions
	): N<8, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<9, Finder>,
		values: N<9, Finder>,
		options: FindTableOptions
	): N<9, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<10, Finder>,
		values: N<10, Finder>,
		options: FindTableOptions
	): N<10, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: N<11, Finder>,
		values: N<11, Finder>,
		options: FindTableOptions
	): N<11, [PageTextLocation, PageTextLocation]> | undefined;
	findTable(
		labels: readonly Finder[],
		values: readonly Finder[],
		{ labelAlignment, valueAlignment, maxGap }: FindTableOptions
	): Array<[PageTextLocation, PageTextLocation]> | undefined {
		if (labels.length !== values.length) {
			throw new Error('labels and values finders must have the same length');
		}

		const entries: Array<[PageTextLocation, PageTextLocation]> = [];
		let lastLabel: PageTextLocation | undefined;
		let lastValue: PageTextLocation | undefined;

		for (let row = 0; row < labels.length; row += 1) {
			const labelFinder = labels[row]!;
			const valueFinder = values[row]!;

			let thisLabel: PageTextLocation | undefined;
			let thisValue: PageTextLocation | undefined;

			if (row === 0) {
				const labelPredicate = predicateForFinder(labelFinder);

				if (!labelPredicate(this.text)) {
					// `this` is supposed to be the first label, but it doesn't match.
					return undefined;
				}

				// eslint-disable-next-line @typescript-eslint/no-this-alias
				thisLabel = this;
				thisValue = thisLabel?.findRight(valueFinder);
			} else {
				thisLabel = lastLabel?.findDown(labelFinder, { alignment: labelAlignment, maxGap });
				thisValue = lastValue?.findDown(valueFinder, { alignment: valueAlignment, maxGap });
			}

			if (!thisLabel || !thisValue) {
				return undefined;
			}

			entries.push([thisLabel, thisValue]);
			lastLabel = thisLabel;
			lastValue = thisValue;
		}

		return entries;
	}

	[Symbol.for('nodejs.util.inspect.custom')]() {
		return `PageTextLocation { text=${this.#text.str}, pageNumber=${this.#pageNumber}, x=${this.#text.x}, y=${this.#text.y} }`;
	}
}

export type Scorer = (text: PageText) => number;
export type Finder = ((text: PageText) => boolean) | string | RegExp;
export type Alignment = 'left' | 'right' | 'either';

function predicateForFinder(finder: Finder): (text: PageText) => boolean {
	if (typeof finder === 'string') {
		return (text: PageText) => text.str === finder;
	} else if (finder instanceof RegExp) {
		return (text: PageText) => finder.test(text.str);
	} else {
		return finder;
	}
}
