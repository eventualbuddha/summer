#!/usr/bin/env node

import { faker } from '@faker-js/faker'; // Import faker.js for generating realistic data.
import { DateTime, Interval } from 'luxon';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argv, exit, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import SurrealDB, { RecordId, Surreal } from 'surrealdb'; // Adjust import as necessary for your SurrealDB setup.
import { z } from 'zod';
import {
	AccountSchema,
	CategorySchema,
	FileSchema,
	StatementSchema,
	TransactionRecordSchema
} from '../src/lib/db.ts';

// Define categories with associated emojis, weights, account-specific weights, and amount ranges.
const categories = [
	{
		name: 'General',
		emoji: '📦',
		weight: 20,
		color: 'red-200',
		accountWeights: { credit: 0.9, checking: 0.1 },
		minAmount: -100,
		maxAmount: -10,
		merchants: [
			'AMAZON WWW.AMAZON.COM',
			'WALMART BENTONVILLE AR 800-925-6278',
			'TARGET MINNEAPOLIS MN 612-304-6073',
			'COSTCO ISSAQUAH WA 425-313-8100',
			'BEST BUY RICHFIELD MN 888-237-8289',
			'HOME DEPOT ATLANTA GA 800-466-3337',
			'LOWES MOORESVILLE NC 800-445-6937',
			'CHEVRON 0093831',
			'IKEA CONSHOHOCKEN PA 888-888-4532',
			'WAYFAIR WWW.WAYFAIR.COM',
			'OVERSTOCK WWW.OVERSTOCK.COM'
		]
	},
	{
		name: 'Dining Out',
		emoji: '🍔',
		weight: 5,
		color: 'amber-400',
		accountWeights: { credit: 0.95, checking: 0.05 },
		minAmount: -50,
		maxAmount: -5,
		merchants: [
			'DD *DOORDASH SUB SAN FRANCISCO CA 00000001 501311',
			'DD DOORDASH MENDOCINO',
			"MCDONALD'S OAK BROOK IL 800-244-6227",
			'STARBUCKS SEATTLE WA 800-782-7282',
			'CHIPOTLE NEWPORT BEACH CA 833-860-0467',
			'SUBWAY MILFORD CT 800-888-4848',
			'PANERA BREAD SUNSET HILLS MO 855-372-6372',
			"DOMINO'S ANN ARBOR MI 734-930-3030",
			'PIZZA HUT PLANO TX 800-948-8488',
			'KFC LOUISVILLE KY 800-225-5532',
			"DUNKIN' CANTON MA 800-447-0013",
			'CHICK-FIL-A ATLANTA GA 866-232-2040'
		]
	},
	{
		name: 'Travel',
		emoji: '✈️',
		weight: 2,
		color: 'orange-200',
		accountWeights: { credit: 0.9, checking: 0.1 },
		minAmount: -300,
		maxAmount: -20,
		merchants: [
			'DELTA AIRLINES ATLANTA GA 800-221-1212',
			'UNITED AIRLINES CHICAGO IL 800-864-8331',
			'AIRBNB WWW.AIRBNB.COM',
			'BKG*BOOKING.COM HOTEL',
			'UBER WWW.UBER.COM',
			'LYFT WWW.LYFT.COM',
			'HILTON HOTELS MCLEAN VA 800-445-8667',
			'MARRIOTT BETHESDA MD 800-535-4028',
			'SOUTHWEST AIRLINES DALLAS TX 800-435-9792',
			'AMTRAK WASHINGTON DC 800-872-7245',
			'EXPEDIA WWW.EXPEDIA.COM'
		]
	},
	{
		name: 'Entertainment',
		emoji: '🎬',
		weight: 3,
		color: 'blue-200',
		accountWeights: { credit: 0.85, checking: 0.15 },
		minAmount: -80,
		maxAmount: -8,
		merchants: [
			'NETFLIX WWW.NETFLIX.COM',
			'SPOTIFY WWW.SPOTIFY.COM',
			'AMC THEATERS LEAWOOD KS 888-440-4262',
			'XBOX REDMOND WA 800-469-9269',
			'PLAYSTATION WWW.PLAYSTATION.COM',
			'DISNEY+ WWW.DISNEYPLUS.COM',
			'HULU WWW.HULU.COM',
			'REGAL CINEMAS KNOXVILLE TN 877-835-5734',
			'APPLE MUSIC CUPERTINO CA 800-692-7753',
			'PANDORA OAKLAND CA 800-555-0199'
		]
	},
	{
		name: 'Groceries',
		emoji: '🛒',
		weight: 10,
		color: 'green-200',
		accountWeights: { credit: 0.7, checking: 0.3 },
		minAmount: -200,
		maxAmount: -15,
		merchants: [
			'SAFEWAY PLEASANTON CA 877-723-3929',
			'KROGER CINCINNATI OH 800-576-4377',
			'WHOLE FOODS AUSTIN TX 844-936-8255',
			"TRADER JOE'S MONROVIA CA 626-599-3700",
			'PUBLIX LAKELAND FL 800-242-1227',
			'ALDI BATAVIA IL 630-879-8100',
			'WEGMANS ROCHESTER NY 800-934-6267',
			'H-E-B SAN ANTONIO TX 210-938-8000',
			'WHOLE FOODS MARKET',
			'MEIJER GRAND RAPIDS MI 877-363-4537',
			'SHOPRITE KEASBEY NJ 800-746-7748'
		]
	},
	{
		name: 'Childcare',
		emoji: '👶',
		weight: 2,
		color: 'blue-200',
		accountWeights: { credit: 0, checking: 1 },
		minAmount: -500,
		maxAmount: -500,
		merchants: ['RIGHT AT SCHOOL']
	}
];

function* eachStartOfMonth(interval: Interval): Generator<DateTime> {
	const start = interval.start!.startOf('month');
	const end = interval.end!.endOf('month');
	let currentDate = start;

	do {
		yield currentDate;
		currentDate = currentDate.plus({ months: 1 });
	} while (currentDate <= end);
}

async function addTransactionsToSurrealDB(
	surreal: SurrealDB,
	interval: Interval,
	numTransactions: number
) {
	const CreatedAccountSchema = AccountSchema.extend({ id: z.instanceof(RecordId) });
	const CreatedCategorySchema = CategorySchema.extend({ id: z.instanceof(RecordId) });
	const CreatedStatementSchema = StatementSchema.extend({
		id: z.instanceof(RecordId),
		account: z.instanceof(RecordId),
		file: z.instanceof(RecordId)
	});
	const CreatedTransactionSchema = TransactionRecordSchema.extend({
		id: z.instanceof(RecordId),
		statement: z.instanceof(RecordId),
		category: z.instanceof(RecordId),
		categoryId: z.void(),
		statementId: z.void()
	});
	const CreatedFileSchema = FileSchema.extend({
		id: z.instanceof(RecordId),
		name: z.string().nonempty(),
		data: z.instanceof(ArrayBuffer)
	});
	type Category = z.infer<typeof CreatedCategorySchema>;
	type Statement = z.infer<typeof CreatedStatementSchema>;
	type Transaction = z.infer<typeof CreatedTransactionSchema>;

	// Create accounts.
	const [creditAccountRecord] = z.tuple([CreatedAccountSchema]).parse(
		await surreal.create('account', {
			name: 'Credit Card',
			type: 'credit'
		})
	);

	const [checkingAccountRecord] = z.tuple([CreatedAccountSchema]).parse(
		await surreal.create('account', {
			name: 'Checking Account',
			type: 'checking'
		})
	);

	// Create categories.
	const categoryRecords: Category[] = [];
	for (const [index, category] of categories.entries()) {
		categoryRecords.push(
			...z.tuple([CreatedCategorySchema]).parse(
				await surreal.create('category', {
					name: category.name,
					color: category.color,
					emoji: category.emoji,
					ordinal: index
				})
			)
		);
	}

	// Generate statements for each month in the date range for both accounts.
	const statements: Statement[] = [];
	for (const startOfMonth of eachStartOfMonth(interval)) {
		const date = startOfMonth.endOf('month').toJSDate();
		const result = await surreal.create('file', {
			name: `Credit Statement ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
			data: Uint8Array.of()
		});
		const [creditStatementFile] = z.tuple([CreatedFileSchema]).parse(result);

		const [creditStatement] = z.tuple([CreatedStatementSchema]).parse(
			await surreal.create('statement', {
				account: creditAccountRecord.id,
				date,
				file: creditStatementFile.id
			})
		);

		const [checkingStatementFile] = z.tuple([CreatedFileSchema]).parse(
			await surreal.create('file', {
				name: `Checking Statement ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
				data: Uint8Array.of()
			})
		);

		const [checkingStatement] = z.tuple([CreatedStatementSchema]).parse(
			await surreal.create('statement', {
				account: checkingAccountRecord.id,
				date,
				file: checkingStatementFile.id
			})
		);

		statements.push(creditStatement, checkingStatement);
	}

	// Weighted random selection of categories.
	function selectWeightedCategory() {
		const totalWeight = categories.reduce((sum, category) => sum + category.weight, 0);
		let random = Math.random() * totalWeight;
		for (const category of categories) {
			if (random < category.weight) return category;
			random -= category.weight;
		}
		return categories[categories.length - 1]; // Fallback.
	}

	// Generate transactions.
	const transactions: Transaction[] = [];
	for (let i = 0; i < numTransactions; i++) {
		const date = interval.start!.plus({
			seconds: Math.random() * interval.toDuration('seconds').seconds
		});
		const category = selectWeightedCategory();
		const amount = parseFloat(
			(Math.random() * (category.maxAmount - category.minAmount) + category.minAmount).toFixed(2)
		);
		const merchant = category.merchants[Math.floor(Math.random() * category.merchants.length)];
		const statementDescription = merchant;
		const description = Math.random() > 0.8 ? faker.lorem.sentence() : undefined;

		const accountType = Math.random() < category.accountWeights.credit ? 'credit' : 'checking';
		const account = accountType === 'credit' ? creditAccountRecord : checkingAccountRecord;

		const statementsForAccount = statements.filter((statement) =>
			statement.account.equals(account.id)
		);
		const statement = statementsForAccount.find((statement) =>
			Interval.fromDateTimes(
				DateTime.fromJSDate(statement.date).startOf('month'),
				DateTime.fromJSDate(statement.date).endOf('month')
			).contains(date)
		);

		if (!statement) {
			throw new Error(`No statement found for account ${account.id} on ${date.toISO()}`);
		}

		const categoryRecord = categoryRecords.find(
			(categoryRecord) => categoryRecord.name === category.name
		);

		if (!categoryRecord) {
			throw new Error(`No category found for name ${category.name}`);
		}

		transactions.push(
			...z.tuple([CreatedTransactionSchema]).parse(
				await surreal.create('transaction', {
					statement: statement.id,
					date: date.toJSDate(),
					amount: amount * 100,
					statementDescription,
					description,
					category: categoryRecord.id
				})
			)
		);
	}
}

const options = parseArgs({
	args: argv.slice(2),
	strict: true,
	options: {
		help: {
			type: 'boolean',
			short: 'h',
			description: 'Display help information'
		},
		transactions: {
			type: 'string',
			short: 't',
			description: 'Number of transactions to create'
		},
		startDate: {
			type: 'string',
			short: 's',
			description: 'Start date for transactions'
		},
		endDate: {
			type: 'string',
			short: 'e',
			description: 'End date for transactions'
		},
		url: {
			type: 'string',
			short: 'u',
			description: 'SurrealDB URL',
			default: 'http://localhost:8000'
		},
		username: {
			type: 'string',
			short: 'U',
			description: 'SurrealDB Username'
		},
		password: {
			type: 'string',
			short: 'p',
			description: 'SurrealDB Password'
		},
		namespace: {
			type: 'string',
			short: 'n',
			description: 'SurrealDB Namespace'
		},
		database: {
			type: 'string',
			short: 'd',
			description: 'SurrealDB Database'
		}
	}
});

function showHelp() {
	stdout.write('Usage: restore [options]\n\n');
	stdout.write('Options:\n');
	stdout.write('  -h, --help         Display help information\n');
	stdout.write('  -i, --input        Input path for backup directory (required)\n');
	stdout.write('  -u, --url          SurrealDB URL [http://localhost:8000]\n');
	stdout.write('  -U, --username     SurrealDB Username\n');
	stdout.write('  -p, --password     SurrealDB Password\n');
	stdout.write('  -n, --namespace    SurrealDB Namespace (required)\n');
	stdout.write('  -d, --database     SurrealDB Database (required)\n');
	stdout.write('  -t, --transactions Number of transactions to create\n');
	stdout.write('  -s, --startDate    Start date for transactions\n');
	stdout.write('  -e, --endDate      End date for transactions\n');
}

if (options.values.help) {
	showHelp();
	exit(0);
}

if (!options.values.url) {
	stdout.write('Error: URL is required\n');
	showHelp();
	exit(1);
}

if (!options.values.namespace) {
	stdout.write('Error: Namespace is required\n');
	showHelp();
	exit(1);
}

if (!options.values.database) {
	stdout.write('Error: Database is required\n');
	showHelp();
	exit(1);
}

const transactions = Number(options.values.transactions) || 100;
const startDate = options.values.startDate
	? DateTime.fromISO(options.values.startDate)
	: DateTime.now().minus({ months: 1 });
const endDate = options.values.endDate ? DateTime.fromISO(options.values.endDate) : DateTime.now();

const db = new Surreal();
await db.connect(options.values.url);

if (options.values.username) {
	const readline = createInterface(stdin);
	const password = await readline.question('Password: ');
	await db.signin({
		username: options.values.username,
		password: password
	});
}

await db.use({ namespace: options.values.namespace, database: options.values.database });

const schema = await readFile(join(import.meta.dirname, '../static/schema.surql'), 'utf8');

stdout.write('Restoring schema…');
await db.query(schema);
stdout.write('\n');

await addTransactionsToSurrealDB(db, Interval.fromDateTimes(startDate, endDate), transactions);

await db.close();
