import { SortedTaggedArraySchema, type Transaction } from '$lib/db';
import { Result } from '@badrap/result';
import { RecordId, Surreal } from 'surrealdb';
import { z } from 'zod';

export interface NewTagged {
	name: string;
	year?: number;
}

export function parseTransactionDescriptionAndTags(description: string): {
	description: string;
	tagged: NewTagged[];
} {
	let p = 0;
	let isParsingTag = false;
	let tagStart = -1;
	let descriptionPartStart = 0;
	const descriptionParts: string[] = [];
	const tagged: NewTagged[] = [];

	function finishTag() {
		if (!isParsingTag) {
			throw new Error('Not parsing a tag');
		}
		isParsingTag = false;
		const tag = description.slice(tagStart, p);
		const match = tag.match(/^#(\S+?)(?:-(\d{4,}))?$/);

		if (!match) {
			throw new Error(`Invalid tag: ${tag}`);
		}

		const name = match[1]!;
		const year = match[2] ? parseInt(match[2], 10) : undefined;
		tagged.push({ name, year });
		descriptionPartStart = p + 1;
	}

	function finishDescriptionPart() {
		if (isParsingTag) {
			throw new Error('Parsing a tag, cannot finish description part');
		}
		const descriptionPart = description.slice(descriptionPartStart, p).trim();
		if (descriptionPart) {
			descriptionParts.push(descriptionPart);
		}
		descriptionPartStart = p + 1;
	}

	for (; p < description.length; p += 1) {
		const c = description[p]!;

		if (isParsingTag) {
			if (/\s/.test(c)) {
				finishTag();
			}
		} else {
			if (c === '#') {
				const cp = description[p - 1];
				if (!cp || /\s/.test(cp)) {
					finishDescriptionPart();
					isParsingTag = true;
					tagStart = p;
				}
			}
		}
	}

	if (isParsingTag) {
		if (tagStart === p - 1) {
			// only got the "#" character, bail on the whole tag thing
			isParsingTag = false;
			descriptionPartStart = tagStart;
			tagStart = -1;
		} else {
			finishTag();
		}
	}

	finishDescriptionPart();

	return {
		description: descriptionParts.join(' ').trim(),
		tagged
	};
}

export async function updateTransactionDescription(
	surreal: Surreal,
	transaction: Transaction,
	description: string
): Promise<Result<void>> {
	const parsed = parseTransactionDescriptionAndTags(description);
	const originalTagged = transaction.tagged;
	const originalDescription = transaction.description;

	transaction.description = parsed.description.trim();
	transaction.tagged = parsed.tagged.map((t, i) => ({
		id: `placeholder-${i}`,
		tag: {
			id: `placeholder-${i}`,
			name: t.name
		},
		year: t.year
	}));

	const taggedRecordsToCreate = parsed.tagged.filter(
		(t) => !originalTagged.some((oldTag) => oldTag.tag.name === t.name && oldTag.year === t.year)
	);
	const taggedRecordsToDelete = originalTagged.filter(
		(t) => !parsed.tagged.some((newTag) => newTag.name === t.tag.name && newTag.year === t.year)
	);

	const params = {
		description: parsed.description,
		transactionId: new RecordId('transaction', transaction.id),
		taggedRecordsToCreate,
		taggedRecordsToDelete: taggedRecordsToDelete.map((t) => new RecordId('tagged', t.id))
	};
	const results = await surreal.queryRaw(
		`
		BEGIN TRANSACTION;

		UPDATE transaction
		SET description = $description
		WHERE id = $transactionId;

		DELETE FROM tagged WHERE id IN $taggedRecordsToDelete;

		FOR $tagged IN $taggedRecordsToCreate {
			LET $tag = (
				SELECT * FROM ONLY tag WHERE name = $tagged.name LIMIT 1
			) ?? (
				CREATE ONLY tag SET name = $tagged.name
			);
			LET $existingTagged = count(
				SELECT * FROM tagged WHERE in.id = $transactionId AND out.id = $tag.id
			);
			IF $existingTagged > 0 {
				THROW 'Tag already exists for this transaction.';
			};
			LET $tagId = $tag.id;
			RELATE $transactionId->tagged->$tagId
			   SET year = $tagged.year;
		};

		SELECT
			id.id() as id,
			->(SELECT id.id() as id, name FROM tag LIMIT 1)[0] as tag,
			year
		FROM tagged
		WHERE in = $transactionId;

		COMMIT TRANSACTION;
		`,
		params
	);

	const errors = results.filter((r) => r.status === 'ERR');
	const errorMessage = errors
		.find(({ status, result }) => status === 'ERR' && !/failed transaction/.test(result))
		?.result?.replace(/^An error occurred:\s*/, '');

	if (errors.length > 0) {
		transaction.description = originalDescription;
		transaction.tagged = originalTagged;
		return Result.err(new Error(errorMessage));
	}

	const [, , , taggedResult] = z
		.tuple([
			// UPDATE transaction
			z.unknown(),
			// DELETE FROM tagged
			z.unknown(),
			// FOR $tag IN $tags { … }
			z.unknown(),
			// SELECT tagged
			z.object({
				status: z.union([z.literal('OK'), z.literal('ERR')]),
				result: SortedTaggedArraySchema
			})
		])
		.parse(results);

	transaction.tagged = taggedResult.result;
	return Result.ok(undefined);
}
