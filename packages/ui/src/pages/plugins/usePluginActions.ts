import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import type { Plugin } from './PluginCard.tsx';

interface InstallResult {
  imported: number;
  skills: string[];
  skillDetails: Array<{ name: string; description: string; isDesign: boolean; samplePrompt?: string }>;
  repo: string;
  designCount: number;
}

interface UsePluginActionsReturn {
  busyOp: string | null;
  actionError: string;
  syncResult: string;
  deleting: string | null;
  installResult: InstallResult | null;
  setActionError: React.Dispatch<React.SetStateAction<string>>;
  setSyncResult: React.Dispatch<React.SetStateAction<string>>;
  setInstallResult: React.Dispatch<React.SetStateAction<InstallResult | null>>;
  handleCreate: (repositoryUrl: string, onSuccess: () => void) => Promise<void>;
  handleSync: () => void;
  handleUpdateAllRepos: () => void;
  handleFetchUsage: () => void;
  handleCategorize: () => void;
  handleTranslateUsage: () => void;
  handleToggleEnabled: (plugin: Plugin) => Promise<void>;
  handleUninstall: (plugin: Plugin) => Promise<void>;
}

export function usePluginActions(): UsePluginActionsReturn {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState('');
  const [syncResult, setSyncResult] = useState('');
  const [busyOp, setBusyOp] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const safeSet = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (val: T | ((prev: T) => T)) => { if (mountedRef.current) setter(val as T); }, []);

  const runExclusive = useCallback(async (opName: string, fn: () => Promise<void>) => {
    if (busyOp !== null) return;
    setBusyOp(opName);
    safeSet(setActionError)('');
    safeSet(setSyncResult)('');
    try {
      await fn();
    } finally {
      if (mountedRef.current) setBusyOp(null);
    }
  }, [busyOp, safeSet]);

  const handleCreate = async (repositoryUrl: string, onSuccess: () => void) => {
    if (!repositoryUrl.trim() || busyOp !== null) return;
    setInstallResult(null);
    const url = repositoryUrl.trim();
    await runExclusive('install', async () => {
      const res = await api.post('/plugins/install-from-github', { repository_url: url });
      const d = res.data.data as InstallResult;
      if (mountedRef.current) {
        setInstallResult(d);
        onSuccess();
        queryClient.invalidateQueries('plugins');
      }
    }).catch((err: unknown) => {
      if (mountedRef.current) setActionError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error'));
    });
  };

  const handleSync = () => runExclusive('sync', async () => {
    const res = await api.post('/plugins/sync', {});
    const d = res.data.data;
    if (mountedRef.current) {
      setSyncResult(
        `同期完了: 新規 ${d.imported}件, 更新 ${d.updated}件, 変更なし ${d.skipped}件` +
        (d.errors?.length ? `, エラー ${d.errors.length}件` : '')
      );
      queryClient.invalidateQueries('plugins');
    }
  }).catch((err: unknown) => {
    if (mountedRef.current) setActionError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error'));
  });

  const handleUpdateAllRepos = () => runExclusive('update', async () => {
    // 1. git pull + DB同期
    const res = await api.post('/plugins/update-all', {});
    const d = res.data.data;

    // 2. ローカルスキルも同期（~/.claude/skills/ の .md ファイルを含む）
    const syncRes = await api.post('/plugins/sync', {}).catch(() => null);
    const s = syncRes?.data?.data;

    if (mountedRef.current) {
      const repoSummary = d.repos.map((r: { repo: string; status: string; error?: string }) =>
        `${r.repo}: ${r.status === 'updated' ? '✓' : `✗ ${r.error ?? ''}`}`
      ).join(', ');
      const syncSummary = s
        ? ` / ローカル: 新規 ${s.imported}件, 更新 ${s.updated}件`
        : '';
      setSyncResult(`更新完了 — ${repoSummary} / リポジトリ: 新規 ${d.imported}件, 更新 ${d.updated}件${syncSummary}`);
      queryClient.invalidateQueries('plugins');
    }
  }).catch((err: unknown) => {
    if (mountedRef.current) setActionError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error'));
  });

  const handleFetchUsage = () => runExclusive('fetchUsage', async () => {
    const res = await api.post('/plugins/fetch-usage', {});
    if (mountedRef.current) {
      setSyncResult(`使い方取得完了: ${res.data.data.updated}件`);
      queryClient.invalidateQueries('plugins');
    }
  }).catch((err: unknown) => {
    if (mountedRef.current) setActionError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error'));
  });

  const handleCategorize = () => runExclusive('categorize', async () => {
    const res = await api.post('/plugins/categorize', {});
    if (mountedRef.current) {
      setSyncResult(`カテゴリ分類完了: ${res.data.data.categorized}件`);
      queryClient.invalidateQueries('plugins');
    }
  }).catch((err: unknown) => {
    if (mountedRef.current) setActionError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error'));
  });

  const handleTranslateUsage = () => runExclusive('translate', async () => {
    const res = await api.post('/plugins/translate-usage', {});
    const d = res.data.data;
    if (mountedRef.current) {
      setSyncResult(`翻訳完了: ${d.translated}件 / 対象 ${d.total}件${d.failed ? ` (失敗 ${d.failed}件)` : ''}`);
      queryClient.invalidateQueries('plugins');
    }
  }).catch((err: unknown) => {
    if (mountedRef.current) setActionError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error'));
  });

  const handleToggleEnabled = async (plugin: Plugin) => {
    setActionError('');
    try {
      await api.patch(`/plugins/${plugin.id}`, { is_active: !plugin.enabled });
      queryClient.invalidateQueries('plugins');
    } catch (err: unknown) {
      setActionError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error'));
    }
  };

  const handleUninstall = async (plugin: Plugin) => {
    // TODO: window.confirm をカスタム確認ダイアログに置き換える
    if (!window.confirm(t('settings.pluginsUninstallConfirm', { name: plugin.name }))) return;
    setActionError('');
    setDeleting(plugin.id);
    try {
      await api.delete(`/plugins/${plugin.id}`);
      queryClient.invalidateQueries('plugins');
    } catch (err: unknown) {
      setActionError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error'));
    } finally {
      setDeleting(null);
    }
  };

  return {
    busyOp,
    actionError,
    syncResult,
    deleting,
    installResult,
    setActionError,
    setSyncResult,
    setInstallResult,
    handleCreate,
    handleSync,
    handleUpdateAllRepos,
    handleFetchUsage,
    handleCategorize,
    handleTranslateUsage,
    handleToggleEnabled,
    handleUninstall,
  };
}

export type { InstallResult };
