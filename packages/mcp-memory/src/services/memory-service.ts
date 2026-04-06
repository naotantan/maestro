import { getDb, memories } from '@maestro/db';
import { eq, and, desc, sql, ilike, or, inArray } from 'drizzle-orm';

// ── Types ──

export interface MemorySaveInput {
  readonly title: string;
  readonly content: string;
  readonly type?: string;
  readonly tags?: readonly string[];
  readonly sessionId?: string;
  readonly projectPath?: string;
  readonly importance?: number;
}

export interface MemoryListFilters {
  readonly type?: string;
  readonly projectPath?: string;
  readonly tag?: string;
  readonly query?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface MemoryUpdateFields {
  readonly title?: string;
  readonly content?: string;
  readonly type?: string;
  readonly tags?: string[];
  readonly importance?: number;
}

const VALID_TYPES = ['user', 'feedback', 'project', 'reference', 'session', 'design', 'report'] as const;

function sanitize(s: string): string {
  return s.replace(/[<>]/g, '').trim();
}

// ── Service Functions ──

export async function saveMemory(companyId: string, input: MemorySaveInput) {
  const db = getDb();
  const memType = input.type && (VALID_TYPES as readonly string[]).includes(input.type)
    ? input.type
    : 'session';
  const importance = input.importance !== undefined
    ? Math.max(1, Math.min(5, input.importance))
    : 3;

  const [created] = await db.insert(memories).values({
    company_id: companyId,
    title: sanitize(input.title),
    content: input.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    type: memType,
    tags: input.tags ? [...input.tags].map(t => sanitize(t)) : [],
    session_id: input.sessionId ?? null,
    project_path: input.projectPath ?? null,
    importance,
  }).returning();

  return created;
}

export async function recallMemories(
  companyId: string,
  query: string,
  opts?: { projectPath?: string; type?: string; limit?: number },
) {
  const db = getDb();
  const maxResults = Math.min(opts?.limit ?? 10, 50);
  const searchTerm = `%${query}%`;

  const conditions = [
    eq(memories.company_id, companyId),
    or(
      ilike(memories.title, searchTerm),
      ilike(memories.content, searchTerm),
    )!,
  ];
  if (opts?.projectPath) conditions.push(eq(memories.project_path, opts.projectPath));
  if (opts?.type) conditions.push(eq(memories.type, opts.type));

  const rows = await db
    .select()
    .from(memories)
    .where(and(...conditions))
    .orderBy(desc(memories.importance), desc(memories.created_at))
    .limit(maxResults);

  // recall_count と last_recalled_at を更新
  if (rows.length > 0) {
    const ids = rows.map(r => r.id);
    await db
      .update(memories)
      .set({
        recall_count: sql`${memories.recall_count} + 1`,
        last_recalled_at: sql`now()`,
      })
      .where(and(
        eq(memories.company_id, companyId),
        inArray(memories.id, ids),
      ));
  }

  return rows;
}

export async function listMemories(companyId: string, filters?: MemoryListFilters) {
  const db = getDb();
  const limit = Math.min(filters?.limit ?? 20, 100);
  const offset = filters?.offset ?? 0;

  const conditions = [eq(memories.company_id, companyId)];
  if (filters?.type) conditions.push(eq(memories.type, filters.type));
  if (filters?.projectPath) conditions.push(eq(memories.project_path, filters.projectPath));
  if (filters?.query) {
    const searchTerm = `%${filters.query}%`;
    conditions.push(or(
      ilike(memories.title, searchTerm),
      ilike(memories.content, searchTerm),
    )!);
  }
  if (filters?.tag) {
    conditions.push(sql`${memories.tags} @> ${JSON.stringify([filters.tag])}::jsonb`);
  }

  const whereClause = and(...conditions);

  const [countResult, rows] = await Promise.all([
    db.select({ cnt: sql<number>`count(*)::int` }).from(memories).where(whereClause),
    db.select().from(memories).where(whereClause)
      .orderBy(desc(memories.created_at))
      .limit(limit)
      .offset(offset),
  ]);

  return { items: rows, total: countResult[0]?.cnt ?? 0 };
}

export async function updateMemory(companyId: string, id: string, fields: MemoryUpdateFields) {
  const db = getDb();

  const updateFields: Record<string, unknown> = { updated_at: new Date() };
  if (fields.title !== undefined) updateFields.title = sanitize(fields.title);
  if (fields.content !== undefined) updateFields.content = fields.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (fields.type !== undefined) updateFields.type = fields.type;
  if (fields.tags !== undefined) updateFields.tags = fields.tags.map(t => sanitize(t));
  if (fields.importance !== undefined) updateFields.importance = Math.max(1, Math.min(5, fields.importance));

  const [updated] = await db
    .update(memories)
    .set(updateFields)
    .where(and(eq(memories.id, id), eq(memories.company_id, companyId)))
    .returning();

  return updated ?? null;
}

export async function deleteMemory(companyId: string, id: string) {
  const db = getDb();
  const [deleted] = await db
    .delete(memories)
    .where(and(eq(memories.id, id), eq(memories.company_id, companyId)))
    .returning();

  return deleted ?? null;
}

export async function getProjectContext(
  companyId: string,
  projectPath: string,
  opts?: { types?: string[]; limit?: number },
) {
  const db = getDb();
  const limit = Math.min(opts?.limit ?? 20, 100);

  const conditions = [
    eq(memories.company_id, companyId),
    eq(memories.project_path, projectPath),
  ];
  if (opts?.types && opts.types.length > 0) {
    conditions.push(
      or(...opts.types.map(t => eq(memories.type, t)))!
    );
  }

  const whereClause = and(...conditions);

  const [countResult, rows] = await Promise.all([
    db.select({ cnt: sql<number>`count(*)::int` }).from(memories).where(whereClause),
    db.select().from(memories).where(whereClause)
      .orderBy(desc(memories.importance), desc(memories.created_at))
      .limit(limit),
  ]);

  return { items: rows, total: countResult[0]?.cnt ?? 0, project_path: projectPath };
}
