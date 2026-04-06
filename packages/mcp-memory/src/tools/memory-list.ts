import { z } from 'zod';
import { listMemories } from '../services/memory-service';

export function registerMemoryList(server: any, companyId: string) {
  server.tool(
    'memory_list',
    '保存済みメモリの一覧を取得する。type、project_path、tag、キーワードでフィルタ可能。',
    {
      type: z.string().optional().describe('記憶の種類で絞り込み'),
      project_path: z.string().optional().describe('プロジェクトパスで絞り込み'),
      tag: z.string().optional().describe('タグで絞り込み'),
      query: z.string().optional().describe('title/content のフリーテキスト検索'),
      limit: z.number().optional().describe('取得件数 (デフォルト20, 最大100)'),
      offset: z.number().optional().describe('オフセット (デフォルト0)'),
    },
    async ({ type, project_path, tag, query, limit, offset }: any) => {
      const result = await listMemories(companyId, {
        type,
        projectPath: project_path,
        tag,
        query,
        limit: limit ?? 20,
        offset: offset ?? 0,
      });

      const formatted = result.items.map(r => ({
        id: r.id,
        title: r.title,
        type: r.type,
        tags: r.tags,
        importance: r.importance,
        recall_count: r.recall_count,
        created_at: r.created_at,
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            total: result.total,
            count: formatted.length,
            limit: limit ?? 20,
            offset: offset ?? 0,
            memories: formatted,
          }, null, 2),
        }],
      };
    },
  );
}
