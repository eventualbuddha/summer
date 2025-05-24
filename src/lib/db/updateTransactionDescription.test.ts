import { expect, test } from 'bun:test';
import { parseTransactionDescriptionAndTags } from './updateTransactionDescription';

test('empty string', () => {
	expect(parseTransactionDescriptionAndTags('')).toEqual({
		description: '',
		tagged: []
	});
});

test('no tags', () => {
	expect(parseTransactionDescriptionAndTags('test')).toEqual({
		description: 'test',
		tagged: []
	});
});

test('one tag', () => {
	expect(parseTransactionDescriptionAndTags('test #tag')).toEqual({
		description: 'test',
		tagged: [{ name: 'tag' }]
	});
});

test('one tag before description', () => {
	expect(parseTransactionDescriptionAndTags('#tag test')).toEqual({
		description: 'test',
		tagged: [{ name: 'tag' }]
	});
});

test('multiple tags', () => {
	expect(parseTransactionDescriptionAndTags('test #tag1 #tag2')).toEqual({
		description: 'test',
		tagged: [{ name: 'tag1' }, { name: 'tag2' }]
	});
});

test('one tag with year', () => {
	expect(parseTransactionDescriptionAndTags('test #tag-2025')).toEqual({
		description: 'test',
		tagged: [{ name: 'tag', year: 2025 }]
	});
});

test('multiple tags interspersed within the description', () => {
	expect(parseTransactionDescriptionAndTags('test #tag1 test2 #tag2 test3')).toEqual({
		description: 'test test2 test3',
		tagged: [{ name: 'tag1' }, { name: 'tag2' }]
	});
});

test('whitespace around tags', () => {
	expect(parseTransactionDescriptionAndTags('  test\t #tag1  #tag2  test3     ')).toEqual({
		description: 'test test3',
		tagged: [{ name: 'tag1' }, { name: 'tag2' }]
	});
});
