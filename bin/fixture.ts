#!/usr/bin/env bun

import { lazy } from '@nfnitloop/better-iterators';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, parse } from 'node:path';
import { argv, exit, stderr, stdout } from 'node:process';
import { parseArgs } from 'node:util';
import type PDFDocument from 'pdfkit';
import { PageText } from '../src/lib/import/statement/page';
import { Statement, StatementSchema } from '../src/lib/import/statement/Statement';

const options = parseArgs({
	args: argv.slice(2),
	strict: true,
	options: {
		help: {
			type: 'boolean',
			short: 'h',
			description: 'Display help information'
		},
		input: {
			type: 'string',
			short: 'i',
			description: 'Input file'
		},
		output: {
			type: 'string',
			short: 'o',
			description: 'Output file'
		}
	}
});

function showHelp(io: NodeJS.WriteStream) {
	io.write('Usage: fixture -i <PATH> -o <PATH>\n\n');
	io.write('Options:\n');
	io.write('  -h, --help         Display help information\n');
	io.write('  -i, --input        Input file\n');
	io.write('  -o, --output       Output file\n');
	io.write('\n');
	io.write('Examples:\n');
	io.write('\n');
	io.write('  Convert a PDF to a fixture file:\n');
	io.write('  $ bin/fixture -i statement.pdf -o test/fixtures/bank/account.json\n');
	io.write('\n');
	io.write('  Convert a fixture file to a PDF:\n');
	io.write('  $ bin/fixture -i test/fixtures/bank/account.json -o statement.pdf\n');
}

if (options.values.help) {
	showHelp(stdout);
	exit(0);
}

if (!options.values.input || !options.values.output) {
	showHelp(stderr);
	exit(1);
}

const inputParts = parse(options.values.input);
const outputParts = parse(options.values.output);

if (inputParts.ext.toLowerCase() === '.pdf' && outputParts.ext.toLowerCase() === '.json') {
	const statement = await Statement.fromPDF(await readFile(options.values.input));
	await mkdir(dirname(options.values.output), { recursive: true });
	await writeFile(options.values.output, JSON.stringify(statement.pages, null, 2));
} else if (inputParts.ext.toLowerCase() === '.json' && outputParts.ext.toLowerCase() === '.pdf') {
	const { default: PDFDocument } = await import('pdfkit');
	const statement = StatementSchema.parse(JSON.parse(await readFile(options.values.input, 'utf8')));
	await mkdir(dirname(options.values.output), { recursive: true });
	const output = createWriteStream(options.values.output);
	const document = new PDFDocument({ autoFirstPage: false });
	const fontSizesByFont = findTextSizeForFonts(
		document,
		statement.pages.flatMap(({ texts }) => texts)
	);
	document.pipe(output);
	for (const page of statement.pages) {
		document.addPage({
			size: 'letter',
			autoFirstPage: false,
			margin: 0
		});
		const pageHeight = 11 * 72;
		for (const text of page.texts) {
			document
				.fontSize(fontSizesByFont.get(text.fontName)!)
				.text(text.str, text.x, pageHeight - text.y);
		}
	}
	const finished = new Promise<void>((resolve) => output.once('finish', resolve));
	document.end();
	await finished;
}

function findTextSizeForFonts(
	document: typeof PDFDocument,
	texts: readonly PageText[]
): Map<string, number> {
	const bestFontSizesByFont = new Map<string, number>();
	const textsByFont = lazy(texts).groupBy((text) => text.fontName);

	for (const [fontName, texts] of textsByFont) {
		const triedFontSizes = new Set<number>();
		let fontSize = 10;
		let bestFontSize = 10;
		let bestError = Infinity;

		while (true) {
			const totalError = texts.reduce(
				(error, text) => error + document.fontSize(fontSize).widthOfString(text.str) - text.width,
				0
			);

			if (Math.abs(totalError) < Math.abs(bestError)) {
				bestError = totalError;
				bestFontSize = fontSize;
			}

			const nextFontSize = totalError > 0 ? fontSize - 1 : fontSize + 1;
			if (triedFontSizes.has(nextFontSize)) {
				break;
			}
			triedFontSizes.add(fontSize);
			fontSize = nextFontSize;
		}

		bestFontSizesByFont.set(fontName, bestFontSize);
	}

	return bestFontSizesByFont;
}
