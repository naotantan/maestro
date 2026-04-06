import { z } from 'zod';
import { recallMemories } from '../services/memory-service';

export function registerMemoryRecall(server: any, companyId: string) {
  server.tool(
    'memory_recall',
    'キーワードで記憶を想起する。title と content を検索し、importance と作成日時でソート。recall_count が自動加算される。',
    {
      query: z.string().describe('検索キーワード'),
      project_path: z.string().optional().describe('プロジェクトパスで絞り込み'),
      type: z.string().optional().describe('記憶の種類で絞り込み'),
      limit: z.number().optional().describe('取得件数 (デフォルト10, 最大50)'),
    },
    async ({ query, project_path, type, limit }: any) => {
      const rows = await recallMemories(companyId, query, {
        projectPath: project_path,
        type,
        limit: limit ?? 10,
      });

      if (rows.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `"${query}" に一致する記憶はありません。`,
          }],
        };
      }

      const formatted = rows.map(r => ({
        id: r.id,
        title: r.title,
        type: r.type,
        content: r.content,
        tags: r.tags,
        importance: r.importance,
        recall_count: r.recall_count,
        created_at: r.created_at,
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ query, count: rows.length, memories: formatted }, null, 2),
        }],
      };
    },
  );
}
