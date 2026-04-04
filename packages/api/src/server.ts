import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { healthRouter } from './routes/health';
import { companiesRouter } from './routes/companies';
import { authRouter } from './routes/auth';
import { orgRouter } from './routes/org';
import { agentsRouter } from './routes/agents';
import { issuesRouter } from './routes/issues';
import { goalsRouter } from './routes/goals';
import { projectsRouter } from './routes/projects';
import { costsRouter } from './routes/costs';
import { routinesRouter } from './routes/routines';
import { approvalsRouter } from './routes/approvals';
import { activityRouter } from './routes/activity';
import { pluginsRouter } from './routes/plugins';
import { settingsRouter } from './routes/settings';
import { handoffsRouter } from './routes/handoffs';
import { tasksRouter } from './routes/tasks';
import { instructionsRouter } from './routes/instructions';
import { sessionSummariesRouter } from './routes/session-summaries';
import { sessionContextRouter } from './routes/session-context';
import { noteArticlesRouter } from './routes/note-articles';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth';
import { activityLogger } from './middleware/activity-logger';

export function createApp(): Express {
  const app = express();

  // セキュリティ設定
  app.use(helmet());

  // 追加のセキュリティヘッダー
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    })
  );

  // CORS設定（複数オリジンのホワイトリスト対応）
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
  const devOriginPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+)(?::\d+)?$/;
  app.use(
    cors({
      origin: (origin, callback) => {
        // 開発時はoriginなしのリクエスト（curlなど）も許可
        if (
          !origin ||
          allowedOrigins.includes(origin.trim()) ||
          (process.env.NODE_ENV === 'development' && devOriginPattern.test(origin.trim()))
        ) {
          callback(null, true);
        } else {
          callback(new Error('CORS policy violation'));
        }
      },
      credentials: true,
    })
  );

  // X-Request-ID ヘッダーを追加（監査ログ用）
  app.use((_req, res, next) => {
    res.setHeader('X-Request-ID', randomUUID());
    next();
  });

  // グローバルレート制限: 15分あたり最大リクエスト数（環境変数 RATE_LIMIT_MAX で上書き可能）
  const rateLimitMax = process.env.RATE_LIMIT_MAX
    ? parseInt(process.env.RATE_LIMIT_MAX, 10)
    : process.env.NODE_ENV === 'development'
      ? 1000
      : 100;
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: rateLimitMax,
      message: {
        error: 'rate_limit_exceeded',
        message: 'リクエストが多すぎます。しばらく待ってから再試行してください。',
      },
    })
  );

  // 認証エンドポイント専用の厳格なレート制限
  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 10, // 15分あたり10回まで
    message: {
      error: 'rate_limit_exceeded',
      message: '認証試行回数が多すぎます。',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ヘルスチェック（認証不要）
  app.use('/health', healthRouter);

  // 認証エンドポイント（認証不要・厳格なレート制限付き）
  app.use('/api/auth', authRateLimit, authRouter);

  // 認証付きルート
  app.use('/api', authMiddleware);
  // Activity自動記録（認証済みの全エンドポイントに適用）
  app.use('/api', activityLogger);
  app.use('/api/org', orgRouter);
  app.use('/api/companies', companiesRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/issues', issuesRouter);
  app.use('/api/goals', goalsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/costs', costsRouter);
  app.use('/api/routines', routinesRouter);
  app.use('/api/approvals', approvalsRouter);
  app.use('/api/activity', activityRouter);
  app.use('/api/plugins', pluginsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/handoffs', handoffsRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/instructions', instructionsRouter);
  app.use('/api/session-summaries', sessionSummariesRouter);
  app.use('/api/session-context', sessionContextRouter);
  app.use('/api/note-articles', noteArticlesRouter);

  // 404ハンドラ（未定義ルートへのリクエストをJSON形式で返す）
  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found', message: '指定されたリソースは存在しません' });
  });

  // エラーハンドリング
  app.use(errorHandler);

  return app;
}
