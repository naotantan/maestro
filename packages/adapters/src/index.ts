export { BaseAdapter } from './base.js';
export type { AdapterConfig, TaskRequest, TaskResponse, HeartbeatResponse } from './base.js';
export { ClaudeLocalAdapter } from './claude-local.js';
export { CodexLocalAdapter } from './codex-local.js';
export { CursorAdapter } from './cursor.js';
export { GeminiLocalAdapter } from './gemini-local.js';
export { OpenclawGatewayAdapter } from './openclaw-gateway.js';
export { OpencodeLocalAdapter } from './opencode-local.js';
export { PiLocalAdapter } from './pi-local.js';

import type { AgentType } from '@company/shared';
import type { AdapterConfig } from './base.js';
import type { BaseAdapter } from './base.js';
import { ClaudeLocalAdapter } from './claude-local.js';
import { CodexLocalAdapter } from './codex-local.js';
import { CursorAdapter } from './cursor.js';
import { GeminiLocalAdapter } from './gemini-local.js';
import { OpenclawGatewayAdapter } from './openclaw-gateway.js';
import { OpencodeLocalAdapter } from './opencode-local.js';
import { PiLocalAdapter } from './pi-local.js';

// アダプターファクトリ — エージェントタイプから適切なアダプターを生成
export function createAdapter(type: AgentType, config: AdapterConfig): BaseAdapter {
  switch (type) {
    case 'claude_local': return new ClaudeLocalAdapter(config);
    case 'codex_local': return new CodexLocalAdapter(config);
    case 'cursor': return new CursorAdapter(config);
    case 'gemini_local': return new GeminiLocalAdapter(config);
    case 'openclaw_gateway': return new OpenclawGatewayAdapter(config);
    case 'opencode_local': return new OpencodeLocalAdapter(config);
    case 'pi_local': return new PiLocalAdapter(config);
    default: throw new Error(`Unknown adapter type: ${type}`);
  }
}
