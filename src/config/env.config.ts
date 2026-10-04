/**
 * 环境变量与命令行参数解析校验模块
 *
 * @author Ateng
 * @since 2026-10-04
 */

import { z } from 'zod';
import type { NacosServerConfig, RawCliOptions } from '../types/index.js';
import { normalizeNamespaceId } from '../utils/normalizer.js';

const configSchema = z.object({
  serverUrl: z
    .string()
    .url({ message: 'Nacos OpenAPI 地址必须为合法的 URL 格式' })
    .default('http://127.0.0.1:8848/nacos'),
  consoleUrl: z
    .string()
    .url({ message: 'Nacos 控制台地址必须为合法的 URL 格式' })
    .default('http://127.0.0.1:8080'),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  namespaceId: z.string().default(''),
  timeout: z.coerce
    .number()
    .int()
    .positive({ message: '超时时间必须为正整数' })
    .default(15000),
  port: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535, { message: '服务端口必须在 1-65535 之间' })
    .default(3000),
  transport: z.enum(['stdio', 'sse']).default('stdio'),
});

/**
 * 规范化 Nacos Server 地址
 *
 * 支持将 host:port 格式快捷推导为完整的 http://host:port/nacos URL。
 *
 * @param rawUrl 完整的 OpenAPI 地址
 * @param rawAddr 简写的 host:port 地址
 * @return 规范化的 URL
 */
function resolveServerUrl(rawUrl?: string, rawAddr?: string): string | undefined {
  if (rawUrl && rawUrl.trim() !== '') {
    const trimmed = rawUrl.trim();
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }

  if (rawAddr && rawAddr.trim() !== '') {
    const trimmed = rawAddr.trim();
    const hasScheme = trimmed.startsWith('http://') || trimmed.startsWith('https://');
    const withScheme = hasScheme ? trimmed : `http://${trimmed}`;
    const cleaned = withScheme.endsWith('/') ? withScheme.slice(0, -1) : withScheme;
    return cleaned.endsWith('/nacos') ? cleaned : `${cleaned}/nacos`;
  }

  return undefined;
}

/**
 * 解析并校验运行配置
 *
 * 命令行参数优先级高于环境变量，缺失值采用系统默认配置。
 *
 * @param env 环境变量映射表
 * @param cliOptions 命令行入参对象
 * @return 校验完毕的强类型运行配置
 * @throws z.ZodError 当入参格式不合法时抛出强校验异常
 */
export function parseConfig(
  env: Record<string, string | undefined> = process.env,
  cliOptions: RawCliOptions = {}
): NacosServerConfig {
  const serverUrl = resolveServerUrl(
    cliOptions.serverUrl || env.MCP_NACOS_SERVER_URL,
    cliOptions.serverAddr || env.MCP_NACOS_SERVER_ADDR
  );

  const consoleUrl = cliOptions.consoleUrl || env.MCP_NACOS_CONSOLE_URL;
  const username = cliOptions.username || env.MCP_NACOS_USERNAME;
  const password = cliOptions.password || env.MCP_NACOS_PASSWORD;
  const rawNamespaceId = cliOptions.namespace ?? env.MCP_NACOS_NAMESPACE_ID;
  const timeout = cliOptions.timeout ?? env.MCP_NACOS_REQUEST_TIMEOUT;
  const port = cliOptions.port ?? env.MCP_PORT;
  const transport = cliOptions.transport || env.MCP_TRANSPORT;

  const rawConfig: Record<string, unknown> = {};

  if (serverUrl !== undefined) {
    rawConfig.serverUrl = serverUrl;
  }
  if (consoleUrl !== undefined) {
    rawConfig.consoleUrl = consoleUrl;
  }
  if (username !== undefined && username.trim() !== '') {
    rawConfig.username = username.trim();
  }
  if (password !== undefined && password.trim() !== '') {
    rawConfig.password = password;
  }
  rawConfig.namespaceId = normalizeNamespaceId(rawNamespaceId);

  if (timeout !== undefined) {
    rawConfig.timeout = timeout;
  }
  if (port !== undefined) {
    rawConfig.port = port;
  }
  if (transport !== undefined) {
    rawConfig.transport = transport;
  }

  const parsed = configSchema.parse(rawConfig);

  return {
    serverUrl: parsed.serverUrl,
    consoleUrl: parsed.consoleUrl,
    username: parsed.username,
    password: parsed.password,
    namespaceId: parsed.namespaceId,
    timeout: parsed.timeout,
    port: parsed.port,
    transport: parsed.transport,
  };
}
