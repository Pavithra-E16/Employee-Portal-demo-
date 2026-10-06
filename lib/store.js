// In-memory server store (resets when the server restarts). Swap for a real database later.
// Seed dates are built from the machine's local date at the moment the server starts.
import { buildSeed } from './data';
import { demoSeed } from './demo';
export const seed = (now = new Date()) => buildSeed(now);
const g = globalThis;
// Re-seed if a hot-reloaded dev server still holds an older data shape.
// First start uses the client-demo roster (House A, 1-15 Oct 2026); tests/resetState use the plain seed.
if (!g.__hrm || g.__hrm.v !== 7) g.__hrm = demoSeed();
export const getState = () => g.__hrm;
export const setState = (s) => { g.__hrm = s; };
export const resetState = () => { g.__hrm = seed(); };
