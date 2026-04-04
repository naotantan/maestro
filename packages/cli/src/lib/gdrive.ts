import { google } from 'googleapis';
import { createServer } from 'http';
import { createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, basename } from 'path';
import { exec } from 'child_process';

// トークン保存先
const TOKEN_PATH = join(homedir(), '.maestro', 'gdrive-token.json');
// OAuth2 コールバック受け取り用ローカルポート
const CALLBACK_PORT = 3456;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/oauth2callback`;

// Google Drive file スコープのみ（アプリが作成したファイルに限定・最小権限）
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/** Google Drive フォルダ URL からフォルダ ID を抽出する */
export function extractFolderId(url: string): string | null {
  // https://drive.google.com/drive/folders/FOLDER_ID
  // https://drive.google.com/drive/u/0/folders/FOLDER_ID
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

/** OAuth2 クライアントを生成する */
function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を .env に設定してください。\n' +
      'Google Cloud Console で OAuth2 クライアントID を作成してください。'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

/** 保存済みトークンを読み込む（なければ null）*/
function loadToken(): object | null {
  if (!existsSync(TOKEN_PATH)) return null;
  try {
    return JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

/** トークンをローカルに保存する */
function saveToken(token: object): void {
  const dir = join(homedir(), '.maestro');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2), { mode: 0o600 });
}

/** ブラウザを開く（macOS/Linux 対応）*/
function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

/** OAuth2 フロー：ブラウザ認証 → コード受け取り → トークン取得・保存 */
async function runOAuthFlow(auth: InstanceType<typeof google.auth.OAuth2>): Promise<void> {
  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',  // リフレッシュトークンを取得
    scope: SCOPES,
    prompt: 'consent',       // 毎回同意画面を表示してリフレッシュトークンを確実に取得
  });

  console.log('\n🔗 ブラウザで Google 認証を行います...');
  console.log('自動で開かない場合は以下の URL を手動でコピーしてください:\n');
  console.log(authUrl);
  console.log('');

  openBrowser(authUrl);

  // ローカルコールバックサーバーでコードを受け取る
  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`);
      const code = url.searchParams.get('code');

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2>✅ 認証完了！このタブを閉じて CLI に戻ってください。</h2>');
        server.close();
        resolve(code);
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2>❌ 認証に失敗しました。</h2>');
        server.close();
        reject(new Error('OAuth2 コードを受け取れませんでした'));
      }
    });

    server.listen(CALLBACK_PORT, () => {
      // サーバー起動を待機（タイムアウト 5 分）
    });

    // 5分でタイムアウト
    setTimeout(() => {
      server.close();
      reject(new Error('認証がタイムアウトしました（5分）。再度お試しください。'));
    }, 5 * 60 * 1000);
  });

  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);
  saveToken(tokens);
  console.log('✅ Google アカウントの連携が完了しました。\n');
}

/**
 * 認証済みの OAuth2 クライアントを返す。
 * トークンがない場合はブラウザ認証フローを実行する。
 */
export async function getAuthenticatedClient(): Promise<InstanceType<typeof google.auth.OAuth2>> {
  const auth = createOAuth2Client();
  const token = loadToken();

  if (token) {
    auth.setCredentials(token as Parameters<typeof auth.setCredentials>[0]);
    // トークン自動リフレッシュ時に保存
    auth.on('tokens', (tokens) => {
      const current = loadToken() as Record<string, unknown> | null ?? {};
      saveToken({ ...current, ...tokens });
    });
  } else {
    await runOAuthFlow(auth);
  }

  return auth;
}

/**
 * ファイルを Google Drive の指定フォルダにアップロードする。
 * @param filePath アップロードするファイルのパス
 * @param folderId Google Drive フォルダ ID
 * @returns アップロードされたファイルの Drive URL
 */
export async function uploadToDrive(filePath: string, folderId: string): Promise<string> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth });

  const fileName = basename(filePath);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: 'application/octet-stream',
      body: createReadStream(filePath),
    },
    fields: 'id, webViewLink',
  });

  const fileId = response.data.id;
  const url = response.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}`;
  return url;
}
