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
