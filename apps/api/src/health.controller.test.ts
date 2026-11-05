import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('responde ok', () => {
    const res = new HealthController().check();
    expect(res.status).toBe('ok');
    expect(Number.isNaN(Date.parse(res.time))).toBe(false);
  });
});
