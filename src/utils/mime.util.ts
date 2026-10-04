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
