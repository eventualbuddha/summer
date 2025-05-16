import { z } from 'zod';
import { PageNavigator } from './navigation';

export class Page {
	readonly pageNumber: number;
	readonly texts: readonly PageText[];
	#navigator?: PageNavigator;

	constructor(pageNumber: number, texts: readonly PageText[]) {
		this.pageNumber = pageNumber;
		this.texts = [...texts].sort((a, b) => b.y - a.y || a.x - b.x);
	}

	get navigator(): PageNavigator {
		return (this.#navigator ??= new PageNavigator(this));
	}
}

export const PageSchema = z
	.object({
		pageNumber: z.number(),
		texts: z.array(z.lazy(() => PageTextSchema))
	})
	.transform((data) => new Page(data.pageNumber, data.texts));

export class PageText {
	readonly str: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly fontName: string;

	constructor(str: string, x: number, y: number, width: number, height: number, fontName: string) {
		this.str = str;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.fontName = fontName;
	}

	get isEmpty(): boolean {
		return this.str.trim().length === 0 || this.width === 0 || this.height === 0;
	}

	get centerX(): number {
		return this.x + this.width / 2;
	}

	get centerY(): number {
		return this.y + this.height / 2;
	}

	get right(): number {
		return this.x + this.width;
	}

	get left(): number {
		return this.x;
	}

	get top(): number {
		return this.y + this.height;
	}

	get bottom(): number {
		return this.y;
	}

	isHorizontallyAlignedWith(other: PageText): boolean {
		const aMid = this.y + this.height / 2;
		const bMid = other.y + other.height / 2;
		return (
			aMid > other.y &&
			aMid < other.y + other.height &&
			bMid > this.y &&
			bMid < this.y + this.height
		);
	}

	isVerticallyAlignedWith(
		other: PageText,
		{ alignment, maxGap = Infinity }: { alignment: 'left' | 'right' | 'either'; maxGap?: number }
	): boolean {
		if (
			Math.abs(
				this.y < other.y ? this.y + this.height - other.y : other.y + other.height - this.y
			) >= maxGap
		) {
			return false;
		}

		switch (alignment) {
			case 'left': {
				return Math.abs(this.x - other.x) < 1;
			}
			case 'right': {
				return Math.abs(this.x + this.width - (other.x + other.width)) < 1;
			}
			case 'either': {
				return (
					Math.abs(this.x - other.x) < 1 ||
					Math.abs(this.x + this.width - (other.x + other.width)) < 1
				);
			}
			default: {
				const _: never = alignment;
				throw new Error(`Invalid alignment: ${_}`);
			}
		}
	}
}

export const PageTextSchema = z
	.object({
		str: z.string(),
		x: z.number(),
		y: z.number(),
		width: z.number(),
		height: z.number(),
		fontName: z.string()
	})
	.transform(
		(data) => new PageText(data.str, data.x, data.y, data.width, data.height, data.fontName)
	);

export class PageTextLine {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly texts: readonly PageText[];

	constructor(texts: readonly PageText[]) {
		this.x = Math.min(...texts.map((t) => t.x));
		this.y = Math.min(...texts.map((t) => t.y));
		this.width = Math.max(...texts.map((t) => t.x + t.width)) - this.x;
		this.height = Math.max(...texts.map((t) => t.y + t.height)) - this.y;
		this.texts = [...texts].sort((a, b) => a.x - b.x);
	}

	get str(): string {
		return this.texts.reduce((acc, text, index, all) => {
			const previous = all[index - 1];
			if (!previous || Math.abs(previous.x + previous.width - text.x) < 1) {
				return acc + text.str;
			} else {
				return `${acc} ${text.str}`;
			}
		}, '');
	}
}
