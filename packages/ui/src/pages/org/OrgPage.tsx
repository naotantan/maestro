import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../../lib/api.ts';

interface OrgInfo {
  id: string;
  name: string;
  createdAt: string;
  members: { id: string; email: string; role: string; joinedAt: string }[];
}

export default function OrgPage() {
  const [inviteEmail, setInviteEmail] = useState('');
  const { data, isLoading, error } = useQuery<OrgInfo>(
    'org',
    () => api.get('/org').then((r) => r.data),
  );

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    await api.post('/org/invite', { email: inviteEmail });
    setInviteEmail('');
  };

  if (isLoading) return <div className="p-6">読み込み中...</div>;
  if (error) return <div className="p-6 text-red-400">エラーが発生しました</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">組織</h1>

      {/* 組織情報 */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-bold mb-2">{data?.name}</h2>
        <p className="text-slate-400 text-sm">作成日: {data?.createdAt}</p>
      </div>

      {/* メンバー招待 */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-bold mb-4">メンバーを招待</h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="メールアドレス..."
            className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
          />
          <button
            onClick={handleInvite}
            className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium"
          >
            招待
          </button>
        </div>
      </div>

      {/* メンバー一覧 */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-bold mb-4">メンバー</h2>
        <div className="space-y-2">
          {data?.members && data.members.length > 0 ? (
            data.members.map((member) => (
              <div
                key={member.id}
                className="flex justify-between items-center py-2 border-b border-slate-700 last:border-b-0"
              >
                <div>
                  <p className="font-bold">{member.email}</p>
                  <p className="text-xs text-slate-400">参加日: {member.joinedAt}</p>
                </div>
                <span className="px-2 py-1 rounded text-xs bg-slate-700">
                  {member.role}
                </span>
              </div>
            ))
          ) : (
            <p className="text-slate-400">メンバーはいません</p>
          )}
        </div>
      </div>
    </div>
  );
}
