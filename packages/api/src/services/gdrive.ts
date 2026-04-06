import { google } from 'googleapis';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/**
 * ADC で実際にアクセストークンを取得できるか確認する。
 */
export async function getGdriveAuthStatus(): Promise<boolean> {
  try {
    const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
    await auth.getAccessToken();
    return true;
  } catch {
    return false;
  }
}

/**
 * ADC を使用した認証済みクライアントを返す。
 * 事前に以下のコマンドを一度実行しておく必要がある：
 *   gcloud auth application-default login \
 *     --scopes=https://www.googleapis.com/auth/drive.file
 */
export function createGdriveAuth(): InstanceType<typeof google.auth.GoogleAuth> {
  return new google.auth.GoogleAuth({ scopes: SCOPES });
}
