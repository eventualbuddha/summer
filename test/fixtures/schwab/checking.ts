import { z } from 'zod';
import rawPages from './checking.json';
import { PageSchema } from '$lib/import/statement/page';
import { Statement } from '$lib/import/statement/Statement';

export const statement = new Statement(z.array(PageSchema).parse(rawPages));
