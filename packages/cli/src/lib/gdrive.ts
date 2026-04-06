import { google } from 'googleapis';
import { createReadStream } from 'fs';
import { basename } from 'path';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/** Google Drive フォルダ URL からフォルダ ID を抽出する */
export function extractFolderId(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

/**
 * ADC を使用した認証済みクライアントを返す。
 * 事前に以下のコマンドを一度実行しておく必要がある：
 *   gcloud auth application-default login \
 *     --scopes=https://www.googleapis.com/auth/drive.file
 */
function createGdriveAuth() {
  return new google.auth.GoogleAuth({ scopes: SCOPES });
}

/**
 * ファイルを Google Drive の指定フォルダにアップロードする。
 */
export async function uploadToDrive(filePath: string, folderId: string): Promise<string> {
  const auth = createGdriveAuth();
  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.create({
    requestBody: {
      name: basename(filePath),
      parents: [folderId],
    },
    media: {
      mimeType: 'application/octet-stream',
      body: createReadStream(filePath),
    },
    fields: 'id, webViewLink',
  });

  const fileId = response.data.id;
  return response.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}`;
}
