/**
 * 核心领域模型与系统契约类型定义
 *
 * @author Ateng
 * @since 2026-10-04
 */

export interface NacosServerConfig {
  /**
   * Nacos 核心 OpenAPI 地址（公网 NAT 场景如 http://<IP>:58848/nacos）
   */
  serverUrl: string;

  /**
   * Nacos Web 控制台地址（公网 NAT 场景如 http://<IP>:57206）
   */
  consoleUrl: string;

  /**
   * 鉴权用户名（可选）
   */
  username?: string;

  /**
   * 鉴权密码（可选）
   */
  password?: string;

  /**
   * 默认命名空间 Tenant ID（空字符串为公共命名空间）
   */
  namespaceId: string;

  /**
   * HTTP 请求超时时间（毫秒）
   */
  timeout: number;

  /**
   * 服务监听端口（供 SSE 或远程模式）
   */
  port: number;

  /**
   * 传输层协议模式
   */
  transport: 'stdio' | 'sse';
}

export interface RawCliOptions {
  serverUrl?: string;
  serverAddr?: string;
  consoleUrl?: string;
  username?: string;
  password?: string;
  namespace?: string;
  timeout?: string | number;
  port?: string | number;
  transport?: string;
}

export interface NacosNamespace {
  namespace: string;
  namespaceShowName: string;
  namespaceDesc?: string;
  quota?: number;
  configCount?: number;
  type?: number;
}

export interface NacosApiResponse<T> {
  code?: number;
  message?: string | null;
  data?: T;
}

export interface NacosConfig {
  id?: string;
  dataId: string;
  group: string;
  content: string;
  md5?: string;
  tenant?: string;
  appName?: string;
  type?: string;
  desc?: string;
}

export interface NacosConfigListResult {
  totalCount: number;
  pageNumber: number;
  pagesAvailable: number;
  pageItems: NacosConfig[];
}

export interface NacosConfigHistoryItem {
  id?: string | number;
  lastId?: string | number;
  dataId: string;
  group: string;
  tenant?: string;
  appName?: string;
  md5?: string;
  content?: string;
  srcUser?: string;
  srcIp?: string;
  opType?: 'I' | 'U' | 'D' | string;
  createdTime?: string;
  lastModifiedTime?: string;
}

export interface NacosConfigHistoryListResult {
  totalCount: number;
  pageNumber: number;
  pagesAvailable: number;
  pageItems: NacosConfigHistoryItem[];
}

export interface NacosServiceDetail {
  name: string;
  groupName: string;
  protectThreshold: number;
  metadata?: Record<string, string>;
  selector?: { type: string };
  clusters?: unknown[];
}

export interface NacosInstance {
  instanceId?: string;
  ip: string;
  port: number;
  weight: number;
  healthy: boolean;
  enabled: boolean;
  ephemeral: boolean;
  clusterName: string;
  serviceName?: string;
  metadata?: Record<string, string>;
}

export interface NacosInstanceListResult {
  name: string;
  groupName: string;
  clusters?: string;
  checksum?: string;
  lastRefTime?: number;
  env?: string;
  useSpecifiedURL?: boolean;
  hosts: NacosInstance[];
}

export interface NacosServerNode {
  ip: string;
  port: number;
  state: string;
  extendInfo?: Record<string, unknown>;
}



