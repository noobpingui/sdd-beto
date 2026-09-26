import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatQuantity, parseQuantity } from '../src/quantity.js';

test('parseQuantity lee valor y unidad', () => {
  assert.deepEqual(parseQuantity('3.5 km'), { value: 3.5, unit: 'km' });
  assert.deepEqual(parseQuantity(' -2m '), { value: -2, unit: 'm' });
});

test('parseQuantity rechaza texto sin unidad', () => {
  assert.throws(() => parseQuantity('12'), /cantidad no válida/);
});

test('formatQuantity redondea a la precisión pedida', () => {
  assert.equal(formatQuantity({ value: 1.23456, unit: 'mi' }), '1.23 mi');
  assert.equal(formatQuantity({ value: 1, unit: 'm' }, 0), '1 m');
});
