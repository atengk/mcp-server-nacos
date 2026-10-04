/**
 * 领域输入静默归一化工具类
 *
 * @author Ateng
 * @since 2026-10-04
 */

/**
 * 静默归一化命名空间标识符
 *
 * 将 undefined、空字符串、以及表示公共命名空间的 "public"/"PUBLIC"
 * 统一转换为底层协议所需的标准空字符串 ""，或兜底至全局默认命名空间。
 *
 * @param rawNamespaceId 原始传入的命名空间标识
 * @param fallbackNamespace 兜底默认命名空间（未指定时为空字符串）
 * @return 归一化后的标准命名空间标识
 */
export function normalizeNamespaceId(
  rawNamespaceId?: string | null,
  fallbackNamespace = ''
): string {
  if (rawNamespaceId === undefined || rawNamespaceId === null) {
    return fallbackNamespace;
  }

  const trimmed = rawNamespaceId.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'public') {
    return fallbackNamespace;
  }

  return trimmed;
}
