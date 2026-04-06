import { registerMemorySave } from './tools/memory-save';
import { registerMemoryRecall } from './tools/memory-recall';
import { registerMemoryList } from './tools/memory-list';
import { registerMemoryUpdate } from './tools/memory-update';
import { registerMemoryDelete } from './tools/memory-delete';
import { registerMemoryContext } from './tools/memory-context';

export function registerTools(server: any, companyId: string): void {
  registerMemorySave(server, companyId);
  registerMemoryRecall(server, companyId);
  registerMemoryList(server, companyId);
  registerMemoryUpdate(server, companyId);
  registerMemoryDelete(server, companyId);
  registerMemoryContext(server, companyId);
}
