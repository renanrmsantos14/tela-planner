import test from 'node:test';
import assert from 'node:assert/strict';

import { entitySetName } from '../src/dataverse.js';

test('resolve os Entity Sets reais validados no metadata Dataverse', () => {
  assert.equal(entitySetName('cr40f_pedidodecotacao'), 'cr40f_pedidodecotacaos');
  assert.equal(entitySetName('cr40f_plannertarefa'), 'cr40f_plannertarefas');
  assert.equal(entitySetName('cr40f_plannertarefaevento'), 'cr40f_plannertarefaeventos');
  assert.equal(entitySetName('cr40f_plannertarearelacao'), 'cr40f_plannertarearelacaos');
  assert.equal(entitySetName('cr40f_plannertarearesponsavel'), 'cr40f_plannertarearesponsavels');
  assert.equal(entitySetName('annotation'), 'annotations');
  assert.equal(entitySetName('systemuser'), 'systemusers');
  assert.equal(entitySetName('team'), 'teams');
});

test('falha fechado para tabela sem metadata validado', () => {
  assert.throws(() => entitySetName('tabela_inventada'), /Entity Set não mapeado/);
});
