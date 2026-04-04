import fetch from 'node-fetch';
import { getApiUrl } from './config.js';
import type { CliConfig } from '@maestro/shared';

export interface ApiErrorResponse {
  error: string;
  message: string;
}

export async function apiRequest<T>(
  method: string,
  path: string,
  apiKey?: string,
  body?: unknown,
): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const response = await fetch(url, {
    method,
    headers,
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
    console.error('認証が必要です。先に maestro login を実行してください。');
    process.exit(1);
  }
  return config.apiKey;
}
