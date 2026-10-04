/**
 * 配置格式与 MIME 类型映射推导工具
 *
 * 根据 Nacos 配置集 ID (Data ID) 后缀自动识别文件类型与标准 MIME 协议。
 *
 * @author Ateng
 * @since 2026-10-04
 */

const MIME_MAP: Record<string, string> = {
  yaml: 'application/yaml',
  yml: 'application/yaml',
  json: 'application/json',
  xml: 'application/xml',
  properties: 'text/x-java-properties',
  html: 'text/html',
  htm: 'text/html',
  toml: 'application/toml',
  txt: 'text/plain',
  text: 'text/plain',
  ini: 'text/plain',
  conf: 'text/plain',
  sql: 'application/sql',
};

/**
 * 根据 Data ID 后缀推导标准 MIME Content-Type
 *
 * @param dataId 配置集标识（如 application.yaml、db.properties 等）
 * @return 标准 MIME 类型字符串，若未识别则兜底为 text/plain
 */
export function resolveConfigMimeType(dataId: string): string {
  if (!dataId) {
    return 'text/plain';
  }

  const lastDot = dataId.lastIndexOf('.');
  if (lastDot === -1 || lastDot === dataId.length - 1) {
    return 'text/plain';
  }

  const ext = dataId.slice(lastDot + 1).toLowerCase().trim();
  return MIME_MAP[ext] || 'text/plain';
}

const CONFIG_TYPE_MAP: Record<string, string> = {
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  xml: 'xml',
  properties: 'properties',
  html: 'html',
  htm: 'html',
  toml: 'toml',
  txt: 'text',
  text: 'text',
};

/**
 * 根据 Data ID 后缀或显式声明推导 Nacos 规范配置格式类型 (Type)
 *
 * @param dataId 配置集标识（如 application.yaml）
 * @param explicitType 外部显式声明的类型（若存在且非空则优先使用）
 * @return Nacos 配置类型（yaml | json | xml | properties | html | toml | text）
 */
export function resolveConfigType(dataId: string, explicitType?: string): string {
  if (explicitType && explicitType.trim()) {
    return explicitType.trim().toLowerCase();
  }

  if (!dataId) {
    return 'text';
  }

  const lastDot = dataId.lastIndexOf('.');
  if (lastDot === -1 || lastDot === dataId.length - 1) {
    return 'text';
  }

  const ext = dataId.slice(lastDot + 1).toLowerCase().trim();
  return CONFIG_TYPE_MAP[ext] || 'text';
}

