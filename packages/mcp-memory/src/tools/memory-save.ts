import { z } from 'zod';
import { saveMemory } from '../services/memory-service';

export function registerMemorySave(server: any, companyId: string) {
  server.tool(
    'memory_save',
    '長期記憶を保存する。プロジェクト知見、ユーザー設定、技術的判断、設計書、レポートなどを将来のセッションで参照可能にする。',
    {
      title: z.string().max(500).describe('短いタイトル (検索用)'),
      content: z.string().describe('記憶の本文'),
      type: z.string().optional().describe('記憶の種類: user, feedback, project, reference, session, design, report'),
      tags: z.array(z.string()).optional().describe('関連タグ'),
      project_path: z.string().optional().describe('関連プロジェクトのパス'),
      importance: z.number().optional().describe('重要度 (1-5, 5が最重要, デフォルト3)'),
    },
    async ({ title, content, type, tags, project_path, importance }: any) => {
      const created = await saveMemory(companyId, {
        title,
        content,
        type: type ?? 'session',
        tags,
        projectPath: project_path,
        importance: importance ?? 3,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            saved: true,
            id: created.id,
            title: created.title,
            type: created.type,
            created_at: created.created_at,
          }, null, 2),
        }],
      };
    },
  );
}
