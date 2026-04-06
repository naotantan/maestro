import { describe, it, expect, vi } from 'vitest';
import {
  findOwnedIssue,
  findOwnedGoal,
  findOwnedAgent,
  findOwnedAgentWithDetails,
  findOwnedApproval,
} from '../utils/ownership.js';

// Build a fake drizzle-like query builder that resolves to the given rows.
// Supports the chained API: db.select().from().where().limit() → Promise<row[]>
// and db.select().from().innerJoin().where().limit() → Promise<row[]>
function makeMockDb(resolvedRows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const terminal = vi.fn().mockResolvedValue(resolvedRows);
  chain.limit = terminal;
  chain.where = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);

  return chain as unknown as ReturnType<typeof import('@maestro/db').getDb>;
}

const COMPANY_ID = 'company-uuid-001';

// --- findOwnedIssue ---
describe('findOwnedIssue', () => {
  it('should return the row when the issue belongs to the company', async () => {
    const row = { id: 'issue-uuid-001' };
    const db = makeMockDb([row]);
    const result = await findOwnedIssue(db, COMPANY_ID, 'issue-uuid-001');
    expect(result).toEqual(row);
  });

  it('should return null when no matching issue is found', async () => {
    const db = makeMockDb([]);
    const result = await findOwnedIssue(db, COMPANY_ID, 'nonexistent-id');
    expect(result).toBeNull();
  });

  it('should call select/from/where/limit on the db', async () => {
    const db = makeMockDb([]);
    await findOwnedIssue(db, COMPANY_ID, 'issue-uuid-001');
    expect(db.select).toHaveBeenCalled();
    expect(db.from).toHaveBeenCalled();
    expect(db.where).toHaveBeenCalled();
    expect(db.limit).toHaveBeenCalledWith(1);
  });
});

// --- findOwnedGoal ---
describe('findOwnedGoal', () => {
  it('should return the row when the goal belongs to the company', async () => {
    const row = { id: 'goal-uuid-001' };
    const db = makeMockDb([row]);
    const result = await findOwnedGoal(db, COMPANY_ID, 'goal-uuid-001');
    expect(result).toEqual(row);
  });

  it('should return null when goal is not found', async () => {
    const db = makeMockDb([]);
    const result = await findOwnedGoal(db, COMPANY_ID, 'unknown-goal');
    expect(result).toBeNull();
  });

  it('should call limit(1)', async () => {
    const db = makeMockDb([]);
    await findOwnedGoal(db, COMPANY_ID, 'g1');
    expect(db.limit).toHaveBeenCalledWith(1);
  });
});

// --- findOwnedAgent ---
describe('findOwnedAgent', () => {
  it('should return the row when the agent belongs to the company', async () => {
    const row = { id: 'agent-uuid-001' };
    const db = makeMockDb([row]);
    const result = await findOwnedAgent(db, COMPANY_ID, 'agent-uuid-001');
    expect(result).toEqual(row);
  });

  it('should return null when agent is not found', async () => {
    const db = makeMockDb([]);
    const result = await findOwnedAgent(db, COMPANY_ID, 'unknown-agent');
    expect(result).toBeNull();
  });

  it('should call limit(1)', async () => {
    const db = makeMockDb([]);
    await findOwnedAgent(db, COMPANY_ID, 'a1');
    expect(db.limit).toHaveBeenCalledWith(1);
  });
});

// --- findOwnedAgentWithDetails ---
describe('findOwnedAgentWithDetails', () => {
  it('should return full detail row when found', async () => {
    const row = { id: 'agent-uuid-002', type: 'claude_local', config: { key: 'val' }, enabled: true };
    const db = makeMockDb([row]);
    const result = await findOwnedAgentWithDetails(db, COMPANY_ID, 'agent-uuid-002');
    expect(result).toEqual(row);
    expect(result?.type).toBe('claude_local');
    expect(result?.enabled).toBe(true);
  });

  it('should return null when agent is not found', async () => {
    const db = makeMockDb([]);
    const result = await findOwnedAgentWithDetails(db, COMPANY_ID, 'ghost-agent');
    expect(result).toBeNull();
  });

  it('should call limit(1)', async () => {
    const db = makeMockDb([]);
    await findOwnedAgentWithDetails(db, COMPANY_ID, 'a1');
    expect(db.limit).toHaveBeenCalledWith(1);
  });
});

// --- findOwnedApproval ---
describe('findOwnedApproval', () => {
  it('should return { id, issue_id } when approval belongs to the company', async () => {
    const row = { id: 'approval-uuid-001', issue_id: 'issue-uuid-001' };
    const db = makeMockDb([row]);
    const result = await findOwnedApproval(db, COMPANY_ID, 'approval-uuid-001');
    expect(result).toEqual(row);
    expect(result?.issue_id).toBe('issue-uuid-001');
  });

  it('should return null when approval is not found', async () => {
    const db = makeMockDb([]);
    const result = await findOwnedApproval(db, COMPANY_ID, 'unknown-approval');
    expect(result).toBeNull();
  });

  it('should perform an innerJoin (approvals → issues)', async () => {
    const db = makeMockDb([]);
    await findOwnedApproval(db, COMPANY_ID, 'a1');
    expect(db.innerJoin).toHaveBeenCalled();
  });

  it('should call limit(1)', async () => {
    const db = makeMockDb([]);
    await findOwnedApproval(db, COMPANY_ID, 'a1');
    expect(db.limit).toHaveBeenCalledWith(1);
  });
});
