import Conf from 'conf';
import type { CliConfig } from '@maestro/shared';
import { CLI_CONFIG_DIR } from '@maestro/shared';

const store = new Conf<CliConfig>({
  projectName: CLI_CONFIG_DIR,
  schema: {
    installMode: { type: 'string', enum: ['docker', 'native'] },
    apiUrl: { type: 'string' },
    apiKey: { type: 'string' },
    language: { type: 'string', enum: ['ja', 'en'] },
    version: { type: 'string' },
    createdAt: { type: 'string' },
  },
});

export function getConfig(): CliConfig | null {
  if (!store.has('installMode')) return null;
  return store.store as CliConfig;
}

export function saveConfig(config: CliConfig): void {
  store.set(config);
}

export function clearConfig(): void {
  store.clear();
}

export function getApiUrl(): string {
  return store.get('apiUrl', 'http://localhost:3000') as string;
}
