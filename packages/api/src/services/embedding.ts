/**
 * 埋め込みサービス — Transformers.js (ローカル実行、APIキー不要)
 * モデル: multilingual-e5-small (Xenova/multilingual-e5-small)
 *   - 384次元、多言語対応（日本語◎）
 *   - M1 Mac: 推論 ~30ms, モデルサイズ ~120MB
 *   - E5モデル規約: 保存テキストは "passage: " prefix、検索クエリは "query: " prefix
 *   - トークン上限は512。prefix分（最大9文字）を引いた503文字をコンテンツ上限とする
 */

/** prefixを除いたコンテンツの最大文字数 */
const MAX_CONTENT_CHARS = 503;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelineInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let initPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPipeline(): Promise<any> {
  if (pipelineInstance) return pipelineInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // @ts-ignore — @xenova/transformers は ESM のため動的インポートが必要
    const mod = await import('@xenova/transformers');
    const { pipeline, env } = mod;
    env.cacheDir = process.env.HF_CACHE_DIR ?? '/tmp/hf-cache';
    env.allowLocalModels = false;

    console.log('[embedding] モデルをロード中: Xenova/multilingual-e5-small');
    const p = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
    console.log('[embedding] モデルロード完了');
    pipelineInstance = p;
    return p;
  })();

  return initPromise;
}

/** テキストを384次元ベクトルに変換（prefixを含む完成形テキストを渡す） */
async function runEmbed(textWithPrefix: string): Promise<number[]> {
  if (!textWithPrefix || textWithPrefix.trim().length === 0) return new Array(384).fill(0);
  const pipe = await getPipeline();
  // トークン上限512に収める（文字数ベースの近似値）
  const output = await pipe(textWithPrefix.slice(0, 512), { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * ドキュメント（保存側）の埋め込みを生成する
 * E5規約: "passage: " プレフィックスが必要
 */
export async function embedPassage(text: string): Promise<number[]> {
  return runEmbed(`passage: ${text.slice(0, MAX_CONTENT_CHARS)}`);
}

/**
 * クエリ（検索側）の埋め込みを生成する
 * E5規約: "query: " プレフィックスが必要
 */
export async function embedQuery(text: string): Promise<number[]> {
  return runEmbed(`query: ${text.slice(0, MAX_CONTENT_CHARS)}`);
}

/**
 * スキルのembedding用テキストを構築する
 * name + category + description + usage_content（先頭部分）を結合
 */
export function buildPluginEmbedText(plugin: {
  name: string;
  description?: string | null;
  usage_content?: string | null;
  category?: string | null;
}): string {
  const parts: string[] = [plugin.name];
  if (plugin.category) parts.push(plugin.category);
  if (plugin.description) parts.push(plugin.description.slice(0, 150));
  if (plugin.usage_content) parts.push(plugin.usage_content.slice(0, 250));
  return parts.join(' ').slice(0, MAX_CONTENT_CHARS);
}

/** メモリのembedding用テキストを構築する */
export function buildMemoryEmbedText(mem: {
  title: string;
  content: string;
  type?: string | null;
}): string {
  const parts: string[] = [mem.title];
  if (mem.type) parts.push(mem.type);
  parts.push(mem.content.slice(0, 400));
  return parts.join(' ').slice(0, MAX_CONTENT_CHARS);
}

/** セッションサマリーのembedding用テキストを構築する */
export function buildSessionEmbedText(sess: {
  headline?: string | null;
  summary: string;
  decisions?: string[] | null;
}): string {
  const parts: string[] = [];
  if (sess.headline) parts.push(sess.headline);
  parts.push(sess.summary.slice(0, 350));
  if (Array.isArray(sess.decisions) && sess.decisions.length > 0) {
    parts.push(sess.decisions.slice(0, 3).join(' '));
  }
  return parts.join(' ').slice(0, MAX_CONTENT_CHARS);
}

/** 成果物のembedding用テキストを構築する */
export function buildArtifactEmbedText(art: {
  title: string;
  description?: string | null;
  content?: string | null;
  artifact_type?: string | null;
}): string {
  const parts: string[] = [art.title];
  if (art.artifact_type) parts.push(art.artifact_type);
  if (art.description) parts.push(art.description.slice(0, 150));
  if (art.content) parts.push(art.content.slice(0, 200));
  return parts.join(' ').slice(0, MAX_CONTENT_CHARS);
}
