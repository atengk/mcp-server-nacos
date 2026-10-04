/**
 * Unified Git Diff 差异计算工具
 *
 * 基于最长公共子序列 (LCS) 算法实现纯 TypeScript 行级差异对比，
 * 输出符合标准 Git Patch 格式的 Unified Diff 文本。
 *
 * @author Ateng
 * @since 2026-10-04
 */

export interface DiffOptions {
  oldHeader?: string;
  newHeader?: string;
  contextLines?: number;
}

interface DiffOp {
  type: 'equal' | 'delete' | 'insert';
  line: string;
  oldIndex?: number;
  newIndex?: number;
}

interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

/**
 * 计算两段多行文本之间的 Unified Git Diff
 *
 * @param oldText 原始内容（通常为历史快照）
 * @param newText 新内容（通常为当前运行配置）
 * @param options 差异比对头部与上下文行数选项
 * @return 格式化后的 Unified Diff 字符串
 */
export function generateUnifiedDiff(
  oldText: string,
  newText: string,
  options: DiffOptions = {}
): string {
  const oldHeader = options.oldHeader || 'a/history';
  const newHeader = options.newHeader || 'b/current';
  const context = options.contextLines ?? 3;

  if (oldText === newText) {
    return '--- ' + oldHeader + '\n+++ ' + newHeader + '\n@@ (无变更，内容完全一致) @@';
  }

  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);

  // 1. 计算最长公共子序列 (LCS) 动态规划矩阵
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // 2. 回溯还原行级编辑操作序列
  const ops: DiffOp[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({
        type: 'equal',
        line: oldLines[i - 1],
        oldIndex: i,
        newIndex: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({
        type: 'insert',
        line: newLines[j - 1],
        newIndex: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      ops.unshift({
        type: 'delete',
        line: oldLines[i - 1],
        oldIndex: i,
      });
      i--;
    }
  }

  // 3. 将编辑操作切片组织为标准 Diff Hunk 块
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let lastChangeIndex = -1;

  for (let idx = 0; idx < ops.length; idx++) {
    const op = ops[idx];
    const isChange = op.type !== 'equal';

    if (isChange) {
      if (!currentHunk) {
        // 向前吸收至多 context 行相同上下文
        const startIdx = Math.max(0, idx - context);
        let oldStart = 1;
        let newStart = 1;

        // 寻找起始行号
        for (let k = 0; k < startIdx; k++) {
          if (ops[k].type !== 'insert') oldStart++;
          if (ops[k].type !== 'delete') newStart++;
        }

        currentHunk = {
          oldStart,
          oldCount: 0,
          newStart,
          newCount: 0,
          lines: [],
        };

        for (let k = startIdx; k < idx; k++) {
          currentHunk.lines.push(` ${ops[k].line}`);
          currentHunk.oldCount++;
          currentHunk.newCount++;
        }
      }

      if (op.type === 'delete') {
        currentHunk.lines.push(`-${op.line}`);
        currentHunk.oldCount++;
      } else if (op.type === 'insert') {
        currentHunk.lines.push(`+${op.line}`);
        currentHunk.newCount++;
      }
      lastChangeIndex = idx;
    } else if (currentHunk) {
      // 相同行：判断是否在 context 范围内
      if (idx - lastChangeIndex <= context) {
        currentHunk.lines.push(` ${op.line}`);
        currentHunk.oldCount++;
        currentHunk.newCount++;
      } else {
        // 超出 context 范围，闭合当前 hunk
        hunks.push(currentHunk);
        currentHunk = null;
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  // 4. 组装最终 Unified Diff 输出
  const result: string[] = [`--- ${oldHeader}`, `+++ ${newHeader}`];

  for (const hunk of hunks) {
    result.push(
      `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`
    );
    result.push(...hunk.lines);
  }

  return result.join('\n');
}
