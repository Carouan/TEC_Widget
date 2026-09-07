import assert from 'node:assert/strict';
import { nextSmartPlan, periodThreshold } from '../src/planner.js';

const favorites = [
  { id: 'out', profileId: 'outbound', days: [1,2,3,4,5], startTime: '07:00' },
  { id: 'back', profileId: 'inbound', days: [1,2,3,4,5], startTime: '16:00' }
];

const schedules = {
  outbound: [{ time: '07:10' }, { time: '07:40' }],
  inbound: [{ time: '16:10' }, { time: '16:40' }]
};

const getDepartures = (favorite) => schedules[favorite.profileId];

{
  const now = new Date('2026-09-07T06:30:00');
  const plan = nextSmartPlan({ now, favorites, getDepartures });
  assert.equal(plan.favorite.id, 'out');
  assert.equal(plan.firstDeparture.time, '07:10');
}

{
  const now = new Date('2026-09-07T10:00:00');
  const plan = nextSmartPlan({ now, favorites, getDepartures });
  assert.equal(plan.favorite.id, 'back');
  assert.equal(plan.firstDeparture.time, '16:10');
}

{
  const now = new Date('2026-09-07T22:20:00');
  const plan = nextSmartPlan({ now, favorites, getDepartures });
  assert.equal(plan.favorite.id, 'out');
  assert.equal(plan.date.getDate(), 8);
  assert.equal(plan.firstDeparture.time, '07:10');
}

assert.equal(periodThreshold('morning'), 240);
assert.equal(periodThreshold('afternoon'), 720);
assert.equal(periodThreshold('hour', 9), 540);

console.log('Planner tests OK');
