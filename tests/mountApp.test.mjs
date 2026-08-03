import test from 'node:test';
import assert from 'node:assert/strict';

import { getOrCreateRoot, hasReactRoot } from '../src/mountApp.js';

test('reutiliza a raiz React quando o bootstrap é executado novamente', () => {
  const host = {};
  const element = {};
  const roots = [];
  const createRootFactory = (receivedElement) => {
    const root = { receivedElement };
    roots.push(root);
    return root;
  };

  const first = getOrCreateRoot({ host, rootElement: element, createRootFactory });
  const second = getOrCreateRoot({ host, rootElement: element, createRootFactory });

  assert.equal(first, second);
  assert.equal(roots.length, 1);
});

test('cria uma nova raiz quando o container realmente muda', () => {
  const host = {};
  const createRootFactory = (receivedElement) => ({ receivedElement });

  const first = getOrCreateRoot({ host, rootElement: {}, createRootFactory });
  const second = getOrCreateRoot({ host, rootElement: {}, createRootFactory });

  assert.notEqual(first, second);
});

test('reconhece raiz criada por outra cópia do bundle React', () => {
  const element = {};
  Object.defineProperty(element, '__reactContainer$bundleAnterior', { value: {} });

  assert.equal(hasReactRoot(element), true);
  assert.equal(hasReactRoot({}), false);
});
