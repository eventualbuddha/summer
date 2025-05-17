import { PageSchema } from '$lib/import/statement/page';
import { Statement } from '$lib/import/statement/Statement';
import { z } from 'zod';
import rawPages from './apple-card.json';

export function statement(): Statement {
	return new Statement(z.array(PageSchema).parse(rawPages));
}
