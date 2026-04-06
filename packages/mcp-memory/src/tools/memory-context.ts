import { z } from 'zod';
import { getProjectContext } from '../services/memory-service';

export function registerMemoryContext(server: any, companyId: string) {
  server.tool(
    'memory_context',
    '現在のプロジェクトパスに関連するメモリをまとめて取得する。セッション開始時にプロジェクトの文脈を読み込むのに使う。',
    {
      project_path: z.string().describe('プロジェクトのルートパス'),
      types: z.array(z.string()).optional().describe('取得する type の絞り込み'),
      limit: z.number().optional().describe('取得件数 (デフォルト20, 最大100)'),
    },
    async ({ project_path, types, limit }: any) => {
      const result = await getProjectContext(companyId, project_path, {
        types,
        limit: limit ?? 20,
      });

      if (result.items.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `"${project_path}" に関連する記憶はありません。`,
          }],
        };
      }

      const formatted = result.items.map(r => ({
        id: r.id,
        title: r.title,
        type: r.type,
        content: r.content,
        tags: r.tags,
        importance: r.importance,
        created_at: r.created_at,
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_path: result.project_path,
            total: result.total,
            count: formatted.length,
            memories: formatted,
          }, null, 2),
        }],
      };
    },
  );
}
