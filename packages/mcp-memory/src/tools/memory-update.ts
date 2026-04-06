import { z } from 'zod';
import { updateMemory } from '../services/memory-service';

export function registerMemoryUpdate(server: any, companyId: string) {
  server.tool(
    'memory_update',
    '既存の記憶を更新する。指定したフィールドのみ変更される。',
    {
      id: z.string().describe('メモリID (UUID)'),
      title: z.string().optional().describe('新しいタイトル'),
      content: z.string().optional().describe('新しい本文'),
      type: z.string().optional().describe('新しい種類'),
      tags: z.array(z.string()).optional().describe('新しいタグ'),
      importance: z.number().optional().describe('新しい重要度 (1-5)'),
    },
    async ({ id, title, content, type, tags, importance }: any) => {
      const updated = await updateMemory(companyId, id, {
        title,
        content,
        type,
        tags,
        importance,
      });

      if (!updated) {
        return {
          isError: true,
          content: [{
            type: 'text' as const,
            text: `メモリが見つかりません (ID: ${id})`,
          }],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            updated: true,
            id: updated.id,
            title: updated.title,
            updated_at: updated.updated_at,
          }, null, 2),
        }],
      };
    },
  );
}
