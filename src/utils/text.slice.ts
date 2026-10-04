/**
 * 大文本安全截断与按行切片防护 (Token Bloat Protection)
 *
 * 当配置内容超长（>30,000 字符）时自动截断摘要，防止大模型上下文窗口耗尽，
 * 并支持通过 startLine 与 endLine 传入参数进行精确定位阅读。
 *
 * @author Ateng
 * @since 2026-10-04
 */

export const MAX_SAFE_CONFIG_CHARS = 30000;
export const DEFAULT_SUMMARY_LINES = 200;

export interface SliceResult {
  content: string;
  isTruncated: boolean;
  totalLines: number;
  totalChars: number;
  note?: string;
}

/**
 * 安全切片与截断配置文本
 *
 * @param rawContent 原始配置文本
 * @param startLine 起始行号（1-indexed，包含）
 * @param endLine 结束行号（1-indexed，包含）
 * @return 切片处理结果
 */
export function sliceConfigContent(
  rawContent: string,
  startLine?: number,
  endLine?: number
): SliceResult {
  const lines = rawContent.split('\n');
  const totalLines = lines.length;
  const totalChars = rawContent.length;

  // 1. 若显式指定了行号范围，按需截取精准切片
  if (startLine !== undefined || endLine !== undefined) {
    const start = Math.max(1, startLine ?? 1);
    const end = Math.min(totalLines, endLine ?? totalLines);

    if (start > end) {
      return {
        content: '',
        isTruncated: false,
        totalLines,
        totalChars,
        note: `起始行号 (${start}) 大于结束行号 (${end})，未匹配到任何内容。`,
      };
    }

    const sliced = lines.slice(start - 1, end).join('\n');
    return {
      content: sliced,
      isTruncated: false,
      totalLines,
      totalChars,
      note: `已返回第 ${start} 行至第 ${end} 行切片（全文共 ${totalLines} 行 / ${totalChars} 字符）。`,
    };
  }

  // 2. 无行号入参且文本超限时触发安全截断保护
  if (totalChars > MAX_SAFE_CONFIG_CHARS) {
    const summaryLines = lines.slice(0, DEFAULT_SUMMARY_LINES);
    const summaryText = summaryLines.join('\n');

    return {
      content: summaryText,
      isTruncated: true,
      totalLines,
      totalChars,
      note: `⚠️ 超长配置已启用大模型安全保护（全文共 ${totalLines} 行 / ${totalChars} 字符，超过安全阈值 ${MAX_SAFE_CONFIG_CHARS} 字符）。仅展示前 ${DEFAULT_SUMMARY_LINES} 行摘要。如需查看后续内容，请调用 nacos_get_config 并传入 startLine 和 endLine 参数进行分段阅读。`,
    };
  }

  // 3. 正常文本直接完整返回
  return {
    content: rawContent,
    isTruncated: false,
    totalLines,
    totalChars,
  };
}
