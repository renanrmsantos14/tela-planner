import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('webresource inline não injeta tags dentro do bundle JavaScript', async () => {
  const html = await readFile('dist/webresource.html', 'utf8');
  const closingScriptTags = html.match(/<\/script>/g) ?? [];

  assert.equal(closingScriptTags.length, 1);
  assert.match(html, /<script type="module">[^]*<\/script>/);
  assert.doesNotMatch(html, /<script[^>]+src="\/assets\//);
});
