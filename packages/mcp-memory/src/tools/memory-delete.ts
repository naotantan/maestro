import { z } from 'zod';
import { deleteMemory } from '../services/memory-service';

export function registerMemoryDelete(server: any, companyId: string) {
  server.tool(
    'memory_delete',
    '記憶を削除する。',
    {
      id: z.string().describe('メモリID (UUID)'),
    },
    async ({ id }: any) => {
      const deleted = await deleteMemory(companyId, id);

      if (!deleted) {
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
          text: JSON.stringify({ deleted: true, id: deleted.id, title: deleted.title }, null, 2),
        }],
      };
    },
  );
}
