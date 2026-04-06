import { describe, it, expect } from 'vitest';
import {
  API_KEY_PREFIXES,
  AGENT_TYPES,
  ISSUE_STATUSES,
  ISSUE_PRIORITIES,
  ROLES,
  PAGINATION,
  SUPPORTED_LANGUAGES,
  CLI_CONFIG_DIR,
  CLI_CONFIG_FILE,
} from '../constants.js';

describe('Constants', () => {
  // --- API_KEY_PREFIXES ---
  it('API_KEY_PREFIXES should have BOARD and AGENT', () => {
    expect(API_KEY_PREFIXES.BOARD).toBe('comp_live_');
    expect(API_KEY_PREFIXES.AGENT).toBe('agent_live_');
  });

  it('API_KEY_PREFIXES should have exactly 2 entries', () => {
    expect(Object.keys(API_KEY_PREFIXES)).toHaveLength(2);
  });

  // --- AGENT_TYPES ---
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

  it('AGENT_TYPES should not contain claude_api (it is in shared/types but not in AGENT_TYPES)', () => {
    // claude_api is declared in types.ts AgentType but intentionally absent from the constant
    // This test documents that behaviour explicitly
    expect(AGENT_TYPES).not.toContain('claude_api');
  });

  // --- ISSUE_STATUSES ---
  it('ISSUE_STATUSES covers all states', () => {
    expect(Object.values(ISSUE_STATUSES)).toContain('backlog');
    expect(Object.values(ISSUE_STATUSES)).toContain('done');
    expect(Object.values(ISSUE_STATUSES)).toContain('in_progress');
  });

  it('ISSUE_STATUSES should have 6 entries', () => {
    const values = Object.values(ISSUE_STATUSES);
    expect(values).toHaveLength(6);
    expect(values).toContain('todo');
    expect(values).toContain('in_review');
    expect(values).toContain('cancelled');
  });

  // --- ISSUE_PRIORITIES ---
  it('ISSUE_PRIORITIES covers all priorities', () => {
    expect(Object.values(ISSUE_PRIORITIES)).toContain('urgent');
    expect(Object.values(ISSUE_PRIORITIES)).toContain('low');
  });

  it('ISSUE_PRIORITIES should have 5 entries', () => {
    const values = Object.values(ISSUE_PRIORITIES);
    expect(values).toHaveLength(5);
    expect(values).toContain('high');
    expect(values).toContain('medium');
    expect(values).toContain('no_priority');
  });

  // --- ROLES ---
  it('ROLES should define admin, member, viewer', () => {
    expect(ROLES.ADMIN).toBe('admin');
    expect(ROLES.MEMBER).toBe('member');
    expect(ROLES.VIEWER).toBe('viewer');
  });

  it('ROLES should have exactly 3 entries', () => {
    expect(Object.keys(ROLES)).toHaveLength(3);
  });

  // --- PAGINATION ---
  it('PAGINATION DEFAULT_LIMIT should be 20', () => {
    expect(PAGINATION.DEFAULT_LIMIT).toBe(20);
  });

  it('PAGINATION MAX_LIMIT should be 100', () => {
    expect(PAGINATION.MAX_LIMIT).toBe(100);
  });

  it('PAGINATION MAX_LIMIT should be greater than DEFAULT_LIMIT', () => {
    expect(PAGINATION.MAX_LIMIT).toBeGreaterThan(PAGINATION.DEFAULT_LIMIT);
  });

  // --- SUPPORTED_LANGUAGES ---
  it('SUPPORTED_LANGUAGES should include ja and en', () => {
    expect(SUPPORTED_LANGUAGES).toContain('ja');
    expect(SUPPORTED_LANGUAGES).toContain('en');
  });

  it('SUPPORTED_LANGUAGES should have exactly 2 entries', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(2);
  });

  // --- CLI config constants ---
  it('CLI_CONFIG_DIR should be .maestro', () => {
    expect(CLI_CONFIG_DIR).toBe('.maestro');
  });

  it('CLI_CONFIG_FILE should be config.json', () => {
    expect(CLI_CONFIG_FILE).toBe('config.json');
  });
});
