import { Statement } from '$lib/import/statement/Statement';
import { PageSchema } from '$lib/import/statement/page';
import { z } from 'zod';
import rawPages from './skymiles.json';

export function statement(): Statement {
	return new Statement(z.array(PageSchema).parse(rawPages));
}
