import assert from 'node:assert/strict';
import test from 'node:test';

import { waitlistPositionFor } from '../packages/shared/src/lib/waitlist.ts';

test('la position waitlist reste identique sur le web et le mobile', () => {
  assert.equal(waitlistPositionFor('artist@example.com'), 1467);
  assert.equal(waitlistPositionFor('artist@example.com'), waitlistPositionFor('artist@example.com'));
});
