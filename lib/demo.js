// CLIENT-DEMO SCHEDULE (opt-in). Replaces House A's relative-date seed shifts with a fixed roster
// for 1 Oct - 15 Oct 2026, so the client sees real dates. Houses B and C are untouched.
// Used ONLY for the server's first start (see lib/store.js); tests and resetState() use the plain seed.
import { buildSeed, SHIFTS, posOf } from './data';

const P = 'Pavithra Edha';
const C = 'Chaitanya Katta';

// [shift id, date, employee, shift no. (1 = 7:30AM-3:30PM, 2 = 3:30PM-11:30PM)]
export const HOUSE_A_DEMO = [
  // Pavithra Edha - 1st Shift
  [1, '2026-10-01', P, 1],
  [3, '2026-10-02', P, 1],
  [4, '2026-10-03', P, 1], // approved SICK leave same day -> "leave blocks the timesheet" demo
  [22, '2026-10-05', P, 1], // no timesheet yet -> shows as outstanding
  [28, '2026-10-06', P, 1],
  [2, '2026-10-07', P, 1], // Chaitanya is OFF -> Cover-Only swap demo
  [29, '2026-10-09', P, 1], // both working -> Direct Swap demo
  [30, '2026-10-10', P, 1],
  [31, '2026-10-12', P, 1],
  [32, '2026-10-13', P, 1], // both working -> Direct Swap demo
  [33, '2026-10-14', P, 1],
  // Chaitanya Katta - 2nd Shift
  [5, '2026-10-01', C, 2],
  [7, '2026-10-02', C, 2],
  [34, '2026-10-04', C, 2],
  [35, '2026-10-05', C, 2], // no timesheet yet -> shows as outstanding
  [6, '2026-10-08', C, 2], // Pavithra is OFF -> Cover-Only swap demo
  [23, '2026-10-09', C, 2],
  [36, '2026-10-11', C, 2],
  [37, '2026-10-13', C, 2],
  [38, '2026-10-15', C, 2],
];

export function demoSeed(now = new Date()) {
  const s = buildSeed(now);
  const houseA = HOUSE_A_DEMO.map(([id, date, emp, n]) => ({ id, date, emp, house: 'House A', s: SHIFTS[n].s, e: SHIFTS[n].e, pos: posOf(emp) }));
  const sched = [...s.sched.filter((x) => x.house !== 'House A'), ...houseA].sort((a, b) => a.id - b.id);
  // Pavithra's approved sick day moves to the fixed date she is rostered on (3 Oct).
  const reqs = s.reqs.map((r) => (r.id === 4 ? { ...r, from: '2026-10-03', to: '2026-10-03' } : r));
  // Replace the old relative-date House A timesheets with completed ones for 1-4 Oct.
  const ts = (id, emp, date, start, end, hours) => ({ id, emp, date, house: 'House A', start, end, hours, initials: emp.split(' ').map((w) => w[0]).join(''), notes: '', st: 'Completed', at: '' });
  const others = s.timesheets.filter((t) => t.house !== 'House A');
  const timesheets = [
    ...others,
    ts(101, P, '2026-10-01', '07:30', '15:30', 8),
    ts(102, P, '2026-10-02', '07:30', '15:30', 8),
    ts(103, C, '2026-10-01', '15:30', '23:30', 8),
    ts(104, C, '2026-10-02', '15:30', '23:30', 8),
    ts(105, C, '2026-10-04', '15:30', '23:30', 8),
  ];
  return { ...s, sched, reqs, timesheets };
}
