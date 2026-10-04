/**
 * 客户端配置语法安全守卫 (Syntax Guardrails)
 *
 * 在向 Nacos 提交配置前，对 JSON / YAML 等格式进行确定性合规校验与就地拦截。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import YAML from 'yaml';

export interface SyntaxValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 推断配置格式类型
 *
 * @param explicitType 显式指定的配置类型
 * @param dataId 配置集 ID
 * @return 推断后的格式类型（小写）
 */
export function inferConfigType(explicitType?: string, dataId?: string): string {
  if (explicitType && explicitType.trim() !== '') {
    return explicitType.trim().toLowerCase();
  }

  if (dataId) {
    const lower = dataId.toLowerCase();
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
      return 'yaml';
    }
    if (lower.endsWith('.json')) {
      return 'json';
    }
    if (lower.endsWith('.properties')) {
      return 'properties';
    }
    if (lower.endsWith('.xml')) {
      return 'xml';
    }
    if (lower.endsWith('.html') || lower.endsWith('.htm')) {
      return 'html';
    }
  }

  return 'text';
}

/**
 * 校验配置语法合规性
 *
 * 针对 JSON 与 YAML 执行解析试探，格式畸形时直接阻断并返回诊断说明。
 *
 * @param content 配置项文本内容
 * @param explicitType 显式声明的格式类型
 * @param dataId 配置集 ID（可选，用于辅助类型推断）
 * @return 校验结果
 */
export function validateConfigSyntax(
  content: string,
  explicitType?: string,
  dataId?: string
): SyntaxValidationResult {
  const type = inferConfigType(explicitType, dataId);

  // 1. JSON 语法强守卫拦截
  if (type === 'json') {
    try {
      JSON.parse(content);
      return { valid: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        valid: false,
        error: `[语法安全守卫] JSON 语法校验失败: ${errorMsg}\n请检查花括号闭合、引号配对及尾随逗号。`,
      };
    }
  }

  // 2. YAML 语法强守卫拦截
  if (type === 'yaml' || type === 'yml') {
    try {
      YAML.parse(content);
      return { valid: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        valid: false,
        error: `[语法安全守卫] YAML 语法校验失败: ${errorMsg}\n请检查层级缩进（必须为空格，严禁制表符 Tab）及冒号后空格。`,
      };
    }
  }

  return { valid: true };
}
