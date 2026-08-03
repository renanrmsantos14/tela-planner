import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPlannerSubArea,
  insertSubAreaIntoGroup,
} from '../scripts/sitemapNavigation.mjs';

const sitemap = [
  '<SiteMap>',
  '  <Area Id="operacional">',
  '    <Group Id="group_16b0a016">',
  '      <SubArea Id="existing" Url="$webresource:existing.html" />',
  '    </Group>',
  '  </Area>',
  '  <Area Id="financeiro"><Group Id="group_other"><SubArea Id="other" /></Group></Area>',
  '</SiteMap>',
].join('\n');

test('cria a entrada do Planner com webresource e ícone', () => {
  const entry = createPlannerSubArea();

  assert.match(entry, /Id="subarea_tela_planner"/);
  assert.match(entry, /Url="\$webresource:new_TelaPlanner\.html"/);
  assert.match(entry, /VectorIcon="\/WebResources\/cr40f_sitemap_clipboard_list\.svg"/);
  assert.match(entry, /Title="Planner"/);
});

test('insere somente no grupo Operacional e preserva os demais grupos', () => {
  const result = insertSubAreaIntoGroup(sitemap, 'group_16b0a016', createPlannerSubArea());

  assert.match(result, /existing/);
  assert.match(result, /subarea_tela_planner/);
  assert.match(result, /group_other"><SubArea Id="other" \/><\/Group>/);
});

test('é idempotente e não duplica o menu', () => {
  const first = insertSubAreaIntoGroup(sitemap, 'group_16b0a016', createPlannerSubArea());
  const second = insertSubAreaIntoGroup(first, 'group_16b0a016', createPlannerSubArea());

  assert.equal(second, first);
  assert.equal((second.match(/subarea_tela_planner/g) ?? []).length, 1);
});

test('falha fechado quando o grupo esperado não existe', () => {
  assert.throws(
    () => insertSubAreaIntoGroup(sitemap, 'group_missing', createPlannerSubArea()),
    /grupo do sitemap não encontrado/,
  );
});
