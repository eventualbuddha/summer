#!/usr/bin/env node

import { DateTime, Interval } from 'luxon';
import { argv, exit, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { RecordId, Surreal } from 'surrealdb';
import { z } from 'zod';
import {
	AccountSchema,
	CategorySchema,
	FileSchema,
	StatementSchema,
	TransactionRecordSchema
} from '../src/lib/db.ts';
import { migrate } from './migrate.ts';

// ── Types ────────────────────────────────────────────────────────────────────

interface CategoryDef {
	name: string;
	emoji: string;
	color: string;
}

interface VariableCategoryDef {
	name: string; // must match a name in ALL_CATEGORIES
	weight: number;
	accountWeights: { credit: number; checking: number };
	minAmount: number;
	maxAmount: number;
	merchants: string[];
}

interface RecurringTemplateDef {
	categoryName: string;
	dayOfMonth: number;
	minAmount: number;
	maxAmount: number;
	accountType: 'credit' | 'checking';
	merchant: string;
	jitter?: number; // ±days to vary the posting date
}

interface TagRule {
	name: string;
	categoryRules: Array<{ categoryName: string; probability: number }>;
}

// Tags applied to a random subset of transactions based on category.
const TAG_RULES: TagRule[] = [
	{
		name: 'reimbursable',
		categoryRules: [
			{ categoryName: 'Dining Out', probability: 0.08 },
			{ categoryName: 'Shopping', probability: 0.05 },
			{ categoryName: 'Travel', probability: 0.12 }
		]
	},
	{
		name: 'business',
		categoryRules: [
			{ categoryName: 'Dining Out', probability: 0.06 },
			{ categoryName: 'Travel', probability: 0.15 },
			{ categoryName: 'Shopping', probability: 0.03 }
		]
	},
	{
		name: 'vacation',
		categoryRules: [
			{ categoryName: 'Travel', probability: 0.85 },
			{ categoryName: 'Dining Out', probability: 0.03 },
			{ categoryName: 'Entertainment', probability: 0.04 }
		]
	},
	{
		name: 'shared',
		categoryRules: [
			{ categoryName: 'Groceries', probability: 0.2 },
			{ categoryName: 'Dining Out', probability: 0.15 },
			{ categoryName: 'Entertainment', probability: 0.1 }
		]
	},
	{
		name: 'tax deductible',
		categoryRules: [{ categoryName: 'Healthcare', probability: 0.85 }]
	}
];

// ── Category definitions ─────────────────────────────────────────────────────

// All categories created in the database (in display order).
const ALL_CATEGORIES: CategoryDef[] = [
	{ name: 'Housing', emoji: '🏠', color: 'purple-300' },
	{ name: 'Auto', emoji: '🚗', color: 'slate-300' },
	{ name: 'Utilities', emoji: '💡', color: 'yellow-200' },
	{ name: 'Subscriptions', emoji: '📱', color: 'indigo-200' },
	{ name: 'Groceries', emoji: '🛒', color: 'green-200' },
	{ name: 'Dining Out', emoji: '🍔', color: 'amber-400' },
	{ name: 'Gas & Fuel', emoji: '⛽', color: 'yellow-300' },
	{ name: 'Shopping', emoji: '🛍️', color: 'red-200' },
	{ name: 'Healthcare', emoji: '⚕️', color: 'teal-200' },
	{ name: 'Entertainment', emoji: '🎬', color: 'blue-200' },
	{ name: 'Travel', emoji: '✈️', color: 'orange-200' },
	{ name: 'Fitness', emoji: '💪', color: 'emerald-200' },
	{ name: 'Childcare', emoji: '👶', color: 'pink-200' }, // only with --childcare
	{ name: 'Income', emoji: '💰', color: 'green-400' } // only with --income
];

// Randomly distributed variable spending categories.
// Amounts and weights are tuned for a Bay Area/California household.
const VARIABLE_CATEGORIES: VariableCategoryDef[] = [
	{
		name: 'Groceries',
		weight: 18,
		accountWeights: { credit: 0.7, checking: 0.3 },
		minAmount: -20,
		maxAmount: -280,
		merchants: [
			"TRADER JOE'S #194 SAN JOSE CA",
			'SAFEWAY #2414 SUNNYVALE CA',
			'WHOLE FOODS MKT SAN JOSE CA',
			'COSTCO WHSE #0143 MOUNTAIN VIEW CA',
			'SPROUTS FARMERS MKT SANTA CLARA CA',
			'LUCKY SUPERMARKETS #820 CAMPBELL CA',
			'99 RANCH MARKET MILPITAS CA',
			'GROCERY OUTLET MILPITAS CA'
		]
	},
	{
		name: 'Dining Out',
		weight: 12,
		accountWeights: { credit: 0.92, checking: 0.08 },
		minAmount: -12,
		maxAmount: -95,
		merchants: [
			'CHIPOTLE #2341 SAN JOSE CA',
			'STARBUCKS #14392 PALO ALTO CA',
			'DD *DOORDASH 650-555-0100 CA',
			'UBER* EATS HELP.UBER.COM CA',
			'IN-N-OUT BURGER MILPITAS CA',
			"DENNY'S #6632 SANTA CLARA CA",
			'PANDA EXPRESS SUNNYVALE CA',
			'PANERA BREAD #204819 SAN JOSE CA',
			'THAI HOUSE SAN JOSE CA',
			'PHILZ COFFEE SAN JOSE CA',
			'SUPER DUPER BURGERS SAN JOSE CA',
			"RAISING CANE'S SAN JOSE CA"
		]
	},
	{
		name: 'Gas & Fuel',
		weight: 7,
		accountWeights: { credit: 0.6, checking: 0.4 },
		minAmount: -55,
		maxAmount: -100,
		merchants: [
			'CHEVRON #9187 SAN JOSE CA',
			'SHELL OIL #9171 SANTA CLARA CA',
			'COSTCO GAS #0143 MOUNTAIN VIEW CA',
			'ARCO #2394 MILPITAS CA',
			'76 GAS CUPERTINO CA'
		]
	},
	{
		name: 'Shopping',
		weight: 10,
		accountWeights: { credit: 0.88, checking: 0.12 },
		minAmount: -15,
		maxAmount: -200,
		merchants: [
			'AMAZON.COM*AB12CD34 AMZN.COM/BILL WA',
			'TARGET T-2415 SAN JOSE CA',
			'WALMART SUPERCENTER MILPITAS CA',
			'BEST BUY #276 SAN JOSE CA',
			'THE HOME DEPOT #0631 SANTA CLARA CA',
			'WALGREENS #9482 SUNNYVALE CA',
			'CVS PHARMACY #9832 SAN JOSE CA',
			'ROSS STORES #472 CAMPBELL CA',
			"MARSHALL'S #0391 SAN JOSE CA",
			'NORDSTROM RACK MILPITAS CA'
		]
	},
	{
		name: 'Healthcare',
		weight: 4,
		accountWeights: { credit: 0.65, checking: 0.35 },
		minAmount: -25,
		maxAmount: -350,
		merchants: [
			'KAISER PERMANENTE SAN JOSE CA',
			'CVS PHARMACY #9832 SAN JOSE CA',
			'WALGREENS PHARMACY SUNNYVALE CA',
			'SUTTER URGENT CARE SUNNYVALE CA',
			'STANFORD HEALTH CARE PALO ALTO CA',
			'DELTA DENTAL PREMIER SAN JOSE CA'
		]
	},
	{
		name: 'Entertainment',
		weight: 3,
		accountWeights: { credit: 0.9, checking: 0.1 },
		minAmount: -15,
		maxAmount: -120,
		merchants: [
			'AMC THEATRES #8832 SAN JOSE CA',
			'REGAL CINEMAS MILPITAS CA',
			"DAVE & BUSTER'S SAN JOSE CA",
			'TOPGOLF SAN JOSE CA',
			'TICKETMASTER WWW.TICKETMASTER.COM',
			'BOWLERO SAN JOSE CA'
		]
	},
	{
		name: 'Travel',
		weight: 2,
		accountWeights: { credit: 0.95, checking: 0.05 },
		minAmount: -80,
		maxAmount: -800,
		merchants: [
			'SOUTHWEST AIRLINES DALLAS TX',
			'UNITED AIRLINES CHICAGO IL',
			'ALASKA AIR GROUP SEATTLE WA',
			'AIRBNB* PAYMENT WWW.AIRBNB.COM',
			'HILTON HONORS MCLEAN VA',
			'MARRIOTT BONVOY BETHESDA MD',
			'EXPEDIA INC EXPEDIA.COM',
			'LYFT *RIDE SAN FRANCISCO CA'
		]
	}
];

// Fixed monthly recurring transactions representative of CA household bills.
const RECURRING_TEMPLATES: RecurringTemplateDef[] = [
	// ── Housing ──────────────────────────────────────────────────────────────
	{
		categoryName: 'Housing',
		dayOfMonth: 1,
		minAmount: -2750,
		maxAmount: -2750,
		accountType: 'checking',
		merchant: 'EQUITY RESIDENTIAL RENT PMT SAN JOSE CA'
	},
	// ── Auto ─────────────────────────────────────────────────────────────────
	{
		categoryName: 'Auto',
		dayOfMonth: 5,
		minAmount: -427,
		maxAmount: -427,
		accountType: 'checking',
		merchant: 'HONDA FINANCIAL SERVICES AUTOPAY'
	},
	{
		categoryName: 'Auto',
		dayOfMonth: 6,
		minAmount: -178,
		maxAmount: -178,
		accountType: 'checking',
		merchant: 'GEICO INSURANCE AUTOPAY'
	},
	// ── Utilities ────────────────────────────────────────────────────────────
	{
		categoryName: 'Utilities',
		dayOfMonth: 12,
		minAmount: -85,
		maxAmount: -210, // varies with season (AC in summer, heat in winter)
		accountType: 'checking',
		merchant: 'PG&E GAS AND ELECTRIC WEB PAY',
		jitter: 3
	},
	{
		categoryName: 'Utilities',
		dayOfMonth: 15,
		minAmount: -84,
		maxAmount: -84,
		accountType: 'checking',
		merchant: 'COMCAST XFINITY AUTOPAY',
		jitter: 2
	},
	{
		categoryName: 'Utilities',
		dayOfMonth: 18,
		minAmount: -145,
		maxAmount: -145,
		accountType: 'checking',
		merchant: 'T-MOBILE AUTOPAY',
		jitter: 1
	},
	// ── Subscriptions ────────────────────────────────────────────────────────
	{
		categoryName: 'Subscriptions',
		dayOfMonth: 8,
		minAmount: -22.99,
		maxAmount: -22.99,
		accountType: 'credit',
		merchant: 'NETFLIX.COM'
	},
	{
		categoryName: 'Subscriptions',
		dayOfMonth: 15,
		minAmount: -10.99,
		maxAmount: -10.99,
		accountType: 'credit',
		merchant: 'SPOTIFY USA'
	},
	{
		categoryName: 'Subscriptions',
		dayOfMonth: 22,
		minAmount: -14.99,
		maxAmount: -14.99,
		accountType: 'credit',
		merchant: 'AMAZON PRIME*MEMBERSHIP'
	},
	// ── Fitness ──────────────────────────────────────────────────────────────
	{
		categoryName: 'Fitness',
		dayOfMonth: 1,
		minAmount: -49.99,
		maxAmount: -49.99,
		accountType: 'checking',
		merchant: '24 HOUR FITNESS SAN JOSE CA',
		jitter: 2
	}
];

// Optional childcare (--childcare flag)
const CHILDCARE_TEMPLATE: RecurringTemplateDef = {
	categoryName: 'Childcare',
	dayOfMonth: 1,
	minAmount: -2200,
	maxAmount: -2200,
	accountType: 'checking',
	merchant: 'BRIGHT HORIZONS CHILD CARE SAN JOSE CA'
};

// Optional income (--income flag) — bi-weekly direct deposit
const INCOME_CONFIG = {
	categoryName: 'Income',
	minAmount: 4200,
	maxAmount: 4800,
	accountType: 'checking' as const,
	merchant: 'DIRECT DEPOSIT TECHCORP INC'
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function* eachStartOfMonth(interval: Interval): Generator<DateTime> {
	const start = interval.start!.startOf('month');
	const end = interval.end!.endOf('month');
	let current = start;
	do {
		yield current;
		current = current.plus({ months: 1 });
	} while (current <= end);
}

function randomBetween(min: number, max: number): number {
	return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

// ── Data generation ──────────────────────────────────────────────────────────

async function addTransactionsToSurrealDB(
	surreal: Surreal,
	interval: Interval,
	numVariableTransactions: number,
	opts: { includeIncome: boolean; includeChildcare: boolean }
) {
	// Fixed-up schemas for records returned by SurrealDB:
	//   - `id` is RecordId, not string
	//   - `tags` is not a stored field (computed via graph edges), default to []
	//   - `data` on file records comes back as Uint8Array (SurrealDB bytes type)
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
		category: z.instanceof(RecordId).optional(),
		categoryId: z.void(),
		statementId: z.void(),
		tags: z.array(z.string()).default([])
	});
	const CreatedFileSchema = FileSchema.extend({
		id: z.instanceof(RecordId),
		data: z.union([z.instanceof(ArrayBuffer), z.instanceof(Uint8Array)])
	});

	type CategoryRecord = z.infer<typeof CreatedCategorySchema>;
	type Statement = z.infer<typeof CreatedStatementSchema>;

	// Create accounts
	const [creditAccountRecord] = z
		.tuple([CreatedAccountSchema])
		.parse(await surreal.create('account', { name: 'Credit Card', type: 'credit' }));
	const [checkingAccountRecord] = z
		.tuple([CreatedAccountSchema])
		.parse(await surreal.create('account', { name: 'Checking Account', type: 'checking' }));

	// Create categories (filter optional ones based on flags)
	const categoriesToCreate = ALL_CATEGORIES.filter((cat) => {
		if (cat.name === 'Childcare' && !opts.includeChildcare) return false;
		if (cat.name === 'Income' && !opts.includeIncome) return false;
		return true;
	});

	const categoryMap = new Map<string, CategoryRecord>();
	for (const [index, category] of categoriesToCreate.entries()) {
		const [record] = z.tuple([CreatedCategorySchema]).parse(
			await surreal.create('category', {
				name: category.name,
				color: category.color,
				emoji: category.emoji,
				ordinal: index
			})
		);
		categoryMap.set(category.name, record);
	}

	// Create statements (one per account per month)
	const statements: Statement[] = [];
	for (const startOfMonth of eachStartOfMonth(interval)) {
		const date = startOfMonth.endOf('month').toJSDate();
		const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

		const [creditFile] = z.tuple([CreatedFileSchema]).parse(
			await surreal.create('file', {
				name: `Credit Statement ${monthLabel}`,
				data: Uint8Array.of()
			})
		);
		const [creditStatement] = z.tuple([CreatedStatementSchema]).parse(
			await surreal.create('statement', {
				account: creditAccountRecord.id,
				date,
				file: creditFile.id
			})
		);

		const [checkingFile] = z.tuple([CreatedFileSchema]).parse(
			await surreal.create('file', {
				name: `Checking Statement ${monthLabel}`,
				data: Uint8Array.of()
			})
		);
		const [checkingStatement] = z.tuple([CreatedStatementSchema]).parse(
			await surreal.create('statement', {
				account: checkingAccountRecord.id,
				date,
				file: checkingFile.id
			})
		);

		statements.push(creditStatement, checkingStatement);
	}

	// Find the statement covering a given date for the given account
	function findStatement(accountId: RecordId, date: DateTime): Statement {
		const accountStatements = statements.filter((s) => s.account.equals(accountId));
		const statement = accountStatements.find((s) =>
			Interval.fromDateTimes(
				DateTime.fromJSDate(s.date).startOf('month'),
				DateTime.fromJSDate(s.date).endOf('month')
			).contains(date)
		);
		if (!statement) {
			throw new Error(`No statement for account ${accountId} on ${date.toISO()}`);
		}
		return statement;
	}

	// All created transactions, used at the end for tag assignment.
	const allTransactions: Array<{ id: RecordId; categoryName: string }> = [];

	// Create a single transaction record and track it for tag assignment.
	async function createTransaction(params: {
		statement: Statement;
		date: DateTime;
		amount: number;
		statementDescription: string;
		categoryName: string;
		type: 'debit' | 'credit';
	}) {
		const category = categoryMap.get(params.categoryName);
		if (!category) throw new Error(`Unknown category: ${params.categoryName}`);
		const [tx] = z.tuple([CreatedTransactionSchema]).parse(
			await surreal.create('transaction', {
				statement: params.statement.id,
				date: params.date.toJSDate(),
				amount: Math.round(params.amount * 100),
				statementDescription: params.statementDescription,
				category: category.id,
				type: params.type
			})
		);
		allTransactions.push({ id: tx.id, categoryName: params.categoryName });
		return tx;
	}

	// ── Recurring monthly bills ─────────────────────────────────────────────

	const recurringTemplates = [...RECURRING_TEMPLATES];
	if (opts.includeChildcare) recurringTemplates.push(CHILDCARE_TEMPLATE);

	for (const startOfMonth of eachStartOfMonth(interval)) {
		for (const template of recurringTemplates) {
			if (!categoryMap.has(template.categoryName)) continue;

			// Apply optional ±jitter to the day
			const jitter = template.jitter ?? 0;
			const offset = jitter > 0 ? Math.floor(Math.random() * (jitter * 2 + 1)) - jitter : 0;
			const day = Math.min(Math.max(1, template.dayOfMonth + offset), startOfMonth.daysInMonth!);
			const date = startOfMonth.set({ day });

			if (!interval.contains(date)) continue;

			const amount = randomBetween(template.minAmount, template.maxAmount);
			const account =
				template.accountType === 'credit' ? creditAccountRecord : checkingAccountRecord;
			const statement = findStatement(account.id, date);

			await createTransaction({
				statement,
				date,
				amount,
				statementDescription: template.merchant,
				categoryName: template.categoryName,
				type: 'debit'
			});
		}
	}

	// ── Bi-weekly income (optional) ─────────────────────────────────────────

	if (opts.includeIncome && categoryMap.has('Income')) {
		// Start from the first Friday at or after interval.start
		let payday = interval.start!.set({ weekday: 5 });
		if (payday < interval.start!) payday = payday.plus({ weeks: 1 });

		while (payday <= interval.end!) {
			if (interval.contains(payday)) {
				const amount = randomBetween(INCOME_CONFIG.minAmount, INCOME_CONFIG.maxAmount);
				const statement = findStatement(checkingAccountRecord.id, payday);
				await createTransaction({
					statement,
					date: payday,
					amount,
					statementDescription: INCOME_CONFIG.merchant,
					categoryName: INCOME_CONFIG.categoryName,
					type: 'credit'
				});
			}
			payday = payday.plus({ weeks: 2 });
		}
	}

	// ── Variable (randomly distributed) spending ────────────────────────────

	function selectWeightedCategory(): VariableCategoryDef {
		const total = VARIABLE_CATEGORIES.reduce((sum, c) => sum + c.weight, 0);
		let r = Math.random() * total;
		for (const cat of VARIABLE_CATEGORIES) {
			if (r < cat.weight) return cat;
			r -= cat.weight;
		}
		return VARIABLE_CATEGORIES[VARIABLE_CATEGORIES.length - 1]!;
	}

	for (let i = 0; i < numVariableTransactions; i++) {
		const date = interval.start!.plus({
			seconds: Math.random() * interval.toDuration('seconds').seconds
		});
		const category = selectWeightedCategory();
		const amount = randomBetween(category.minAmount, category.maxAmount);
		const merchant = category.merchants[Math.floor(Math.random() * category.merchants.length)]!;
		const accountType = Math.random() < category.accountWeights.credit ? 'credit' : 'checking';
		const account = accountType === 'credit' ? creditAccountRecord : checkingAccountRecord;
		const statement = findStatement(account.id, date);

		await createTransaction({
			statement,
			date,
			amount,
			statementDescription: merchant,
			categoryName: category.name,
			type: 'debit'
		});

		if (i > 0 && i % 100 === 0) stdout.write('.');
	}

	stdout.write('\n');

	// ── Apply tags ──────────────────────────────────────────────────────────

	// Build a map of tag name → transaction RecordIds based on TAG_RULES probabilities.
	const tagTransactionMap = new Map<string, RecordId[]>();
	for (const { id, categoryName } of allTransactions) {
		for (const rule of TAG_RULES) {
			const categoryRule = rule.categoryRules.find((r) => r.categoryName === categoryName);
			if (categoryRule && Math.random() < categoryRule.probability) {
				if (!tagTransactionMap.has(rule.name)) tagTransactionMap.set(rule.name, []);
				tagTransactionMap.get(rule.name)!.push(id);
			}
		}
	}

	for (const [tagName, txIds] of tagTransactionMap) {
		if (txIds.length === 0) continue;
		await surreal.queryRaw(
			`LET $tag = (UPSERT tag SET name = $name WHERE name = $name RETURN VALUE id)[0];
			 FOR $transaction IN $transactions {
			     RELATE $transaction->tagged->$tag;
			 };`,
			{ name: tagName, transactions: txIds }
		);
	}
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const OPTIONS = {
	help: { type: 'boolean', short: 'h' },
	transactions: { type: 'string', short: 't' },
	startDate: { type: 'string', short: 's' },
	endDate: { type: 'string', short: 'e' },
	url: { type: 'string', short: 'u', default: 'http://localhost:8000' },
	username: { type: 'string', short: 'U' },
	password: { type: 'string', short: 'p' },
	namespace: { type: 'string', short: 'n' },
	database: { type: 'string', short: 'd' },
	income: { type: 'boolean' },
	childcare: { type: 'boolean' },
	force: { type: 'boolean', short: 'f' }
} as const;

function showHelp() {
	stdout.write('Usage: create-demo [options]\n\n');
	stdout.write('Creates a realistic CA household demo dataset in SurrealDB.\n\n');
	stdout.write('Options:\n');
	stdout.write('  -h, --help           Display this help message\n');
	stdout.write('  -t, --transactions   Number of variable transactions [600]\n');
	stdout.write('  -s, --startDate      Start date ISO 8601 [2 years ago]\n');
	stdout.write('  -e, --endDate        End date ISO 8601 [today]\n');
	stdout.write('  -u, --url            SurrealDB URL [http://localhost:8000]\n');
	stdout.write('  -U, --username       SurrealDB username\n');
	stdout.write('  -n, --namespace      SurrealDB namespace (required)\n');
	stdout.write('  -d, --database       SurrealDB database (required)\n');
	stdout.write('      --income         Include bi-weekly paycheck deposits (~$4500)\n');
	stdout.write('      --childcare      Include monthly childcare expense (~$2200)\n');
	stdout.write('  -f, --force          Drop the database if it exists and re-create it\n');
}

export async function main(cliArgv: readonly string[]): Promise<number> {
	const options = parseArgs({ args: cliArgv.slice(2), strict: true, options: OPTIONS });

	if (options.values.help) {
		showHelp();
		return 0;
	}

	if (!options.values.namespace) {
		stdout.write('Error: --namespace is required\n');
		showHelp();
		return 1;
	}

	if (!options.values.database) {
		stdout.write('Error: --database is required\n');
		showHelp();
		return 1;
	}

	const numTransactions = Number(options.values.transactions) || 600;
	const startDate = options.values.startDate
		? DateTime.fromISO(options.values.startDate)
		: DateTime.now().minus({ years: 2 });
	const endDate = options.values.endDate
		? DateTime.fromISO(options.values.endDate)
		: DateTime.now();
	const interval = Interval.fromDateTimes(startDate, endDate);
	const months = Math.round(interval.length('months'));

	const db = new Surreal();
	await db.connect(options.values.url!);

	let password: string | undefined;
	if (options.values.username) {
		const readline = createInterface(stdin);
		password = await readline.question('Password: ');
		await db.signin({ username: options.values.username, password });
	}

	const { namespace, database } = options.values;

	// Check whether the database already exists.
	await db.use({ namespace });
	const [nsInfo] = await db.query<[{ databases: Record<string, string> }]>('INFO FOR NS;');
	const dbExists = database in nsInfo.databases;

	if (dbExists) {
		if (!options.values.force) {
			stdout.write(`Error: database "${database}" already exists in namespace "${namespace}".\n`);
			stdout.write('Use --force to drop and re-create it.\n');
			await db.close();
			return 1;
		}
		stdout.write(`Removing existing database "${database}"…`);
		await db.query(`REMOVE DATABASE \`${database}\`;`);
		stdout.write(' done\n');
	}

	const migrateResult = await migrate({
		url: options.values.url!,
		namespace,
		database,
		username: options.values.username,
		password,
		progress(message) {
			stdout.write(`  ${message}\n`);
		}
	});
	if (migrateResult !== 0) {
		await db.close();
		return migrateResult;
	}

	await db.use({ namespace, database });

	stdout.write(
		`Generating ${numTransactions} variable transactions over ${months} months` +
			(options.values.income ? ' + bi-weekly income' : '') +
			(options.values.childcare ? ' + childcare' : '') +
			'…\n'
	);

	await addTransactionsToSurrealDB(db, interval, numTransactions, {
		includeIncome: options.values.income ?? false,
		includeChildcare: options.values.childcare ?? false
	});

	stdout.write('Done!\n');
	await db.close();
	return 0;
}

if (import.meta.main) {
	const exitCode = await main(argv);
	exit(exitCode);
}
