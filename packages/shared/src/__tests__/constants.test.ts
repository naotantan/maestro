import { describe, it, expect } from 'vitest';
import { API_KEY_PREFIXES, AGENT_TYPES, ISSUE_STATUSES, ISSUE_PRIORITIES } from '../constants.js';

describe('Constants', () => {
  it('API_KEY_PREFIXES should have BOARD and AGENT', () => {
    expect(API_KEY_PREFIXES.BOARD).toBe('comp_live_');
    expect(API_KEY_PREFIXES.AGENT).toBe('agent_live_');
  });

  it('AGENT_TYPES should contain all 7 adapters', () => {
    expect(AGENT_TYPES).toContain('claude_local');
    expect(AGENT_TYPES).toContain('codex_local');
    expect(AGENT_TYPES).toContain('cursor');
    expect(AGENT_TYPES).toContain('gemini_local');
    expect(AGENT_TYPES).toContain('openclaw_gateway');
    expect(AGENT_TYPES).toContain('opencode_local');
    expect(AGENT_TYPES).toContain('pi_local');
    expect(AGENT_TYPES.length).toBe(7);
  });

  it('ISSUE_STATUSES covers all states', () => {
    expect(Object.values(ISSUE_STATUSES)).toContain('backlog');
    expect(Object.values(ISSUE_STATUSES)).toContain('done');
    expect(Object.values(ISSUE_STATUSES)).toContain('in_progress');
  });

  it('ISSUE_PRIORITIES covers all priorities', () => {
    expect(Object.values(ISSUE_PRIORITIES)).toContain('urgent');
    expect(Object.values(ISSUE_PRIORITIES)).toContain('low');
  });
});
