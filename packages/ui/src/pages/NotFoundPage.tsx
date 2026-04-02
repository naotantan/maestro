import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <h1 className="text-9xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent mb-2">
            404
          </h1>
          <p className="text-slate-400 text-lg">ページが見つかりません</p>
        </div>

        <p className="text-slate-400 mb-8">
          申し訳ありません。アクセスしようとしたページは存在しないか、削除された可能性があります。
        </p>

        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            onClick={() => navigate('/')}
            className="w-full"
          >
            ホームに戻る
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            className="w-full"
          >
            前のページに戻る
          </Button>
        </div>

        <div className="mt-12 text-6xl opacity-20">🚀</div>
      </div>
    </div>
  );
}
