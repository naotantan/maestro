import fetch from 'node-fetch';
import { getApiUrl } from './config.js';
import type { CliConfig } from '@company/shared';

export interface ApiErrorResponse {
  error: string;
  message: string;
}

export async function apiRequest<T>(
  method: string,
  path: string,
  apiKey: string,
  body?: unknown,
): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json() as ApiErrorResponse;
    throw new Error(`API Error ${response.status}: ${error.message || error.error}`);
  }

  return response.json() as Promise<T>;
}

export function checkAuth(config: CliConfig | null): string {
  if (!config?.apiKey) {
    console.error('認証が必要です。先に company login を実行してください。');
    process.exit(1);
  }
  return config.apiKey;
}
