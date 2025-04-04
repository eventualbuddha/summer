import { getDocument, type PDFPageProxy } from 'pdfjs-dist';
import { Page, PageSchema, PageText } from './page';
import { lazy, range } from '@nfnitloop/better-iterators';
import { z } from 'zod';

/**
 * A parsed PDF statement.
 */
export class Statement {
	readonly pages: readonly Page[];

	constructor(pages: readonly Page[]) {
		this.pages = pages;
	}

	/**
	 * Parses a PDF document, but does not parse financial information.
	 */
	static async fromPDF(data: Uint8Array | BufferSource): Promise<Statement> {
		const pdf = await getDocument(data).promise;
		return new Statement(
			await range({ from: 1, to: pdf.numPages, inclusive: true })
				.toAsync()
				.map(
					async (pageNumber) =>
						new Page(
							pageNumber,
							await lazy(getAllPageText(await pdf.getPage(pageNumber))).toArray()
						)
				)
				.toArray()
		);
	}
}

export const StatementSchema = z.array(PageSchema).transform((pages) => new Statement(pages));

async function* getAllPageText(page: PDFPageProxy): AsyncGenerator<PageText> {
	const textContent = await page.getTextContent();
	for (const item of textContent.items) {
		if ('str' in item) {
			yield new PageText(
				item.str,
				item.transform[4]!,
				item.transform[5]!,
				item.width,
				item.height,
				item.fontName
			);
		}
	}
}
