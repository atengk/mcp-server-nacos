/**
 * Nacos 3.0 OpenAPI In-Memory 测试 Mock 适配器
 *
 * 遵循最高测试接缝黑盒策略，以零外部依赖在内存中精确模拟 Nacos 服务端行为。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import type { NacosNamespace } from '../../src/types/index.js';

export interface MockNacosOptions {
  requireAuth?: boolean;
  expectedToken?: string;
  simulateTimeout?: boolean;
}

export interface MockConfigItem {
  dataId: string;
  group: string;
  tenant: string;
  content: string;
  type?: string;
  desc?: string;
  appName?: string;
}

export interface MockHistoryItem {
  id: number;
  lastId?: number;
  dataId: string;
  group: string;
  tenant: string;
  appName?: string;
  md5: string;
  content: string;
  srcUser?: string;
  srcIp?: string;
  opType: 'I' | 'U' | 'D';
  createdTime: string;
  lastModifiedTime: string;
}

export class MockNacosServer {
  public namespaces: NacosNamespace[] = [
    {
      namespace: '',
      namespaceShowName: 'public',
      namespaceDesc: '默认公共空间',
      quota: 200,
      configCount: 12,
      type: 0,
    },
    {
      namespace: 'dev-env',
      namespaceShowName: '开发测试环境',
      namespaceDesc: '日常测试集群',
      quota: 200,
      configCount: 3,
      type: 2,
    },
  ];

  public configs: MockConfigItem[] = [
    {
      dataId: 'application.yaml',
      group: 'DEFAULT_GROUP',
      tenant: '',
      content: 'server:\n  port: 8080\nspring:\n  application:\n    name: demo-app',
      type: 'yaml',
      desc: '全局默认配置',
      appName: 'demo-app',
    },
    {
      dataId: 'user-service.json',
      group: 'DEFAULT_GROUP',
      tenant: '',
      content: '{\n  "serviceName": "user-service",\n  "version": "1.0.0"\n}',
      type: 'json',
      desc: '用户微服务配置',
      appName: 'user-service',
    },
    {
      dataId: 'dev-gateway.yaml',
      group: 'GATEWAY_GROUP',
      tenant: 'dev-env',
      content: 'gateway:\n  routes:\n    - id: user\n      uri: lb://user-service',
      type: 'yaml',
      desc: '开发网关路由',
      appName: 'gateway',
    },
  ];

  public history: MockHistoryItem[] = [
    {
      id: 101,
      dataId: 'application.yaml',
      group: 'DEFAULT_GROUP',
      tenant: '',
      appName: 'demo-app',
      md5: 'md5-sample-v1',
      content: 'server:\n  port: 8079\nspring:\n  application:\n    name: demo-app-v1',
      srcUser: 'nacos',
      srcIp: '127.0.0.1',
      opType: 'I',
      createdTime: '2026-10-04 10:00:00',
      lastModifiedTime: '2026-10-04 10:00:00',
    },
    {
      id: 102,
      lastId: 101,
      dataId: 'application.yaml',
      group: 'DEFAULT_GROUP',
      tenant: '',
      appName: 'demo-app',
      md5: 'md5-sample-v2',
      content: 'server:\n  port: 8080\nspring:\n  application:\n    name: demo-app',
      srcUser: 'nacos',
      srcIp: '127.0.0.1',
      opType: 'U',
      createdTime: '2026-10-04 11:00:00',
      lastModifiedTime: '2026-10-04 11:00:00',
    },
  ];

  public lastRequestConfig?: InternalAxiosRequestConfig;
  public authFailuresRemaining = 0;
  public options: MockNacosOptions;

  constructor(options: MockNacosOptions = {}) {
    this.options = {
      requireAuth: false,
      expectedToken: 'mock-valid-token',
      ...options,
    };
  }

  public createAdapter(): AxiosAdapter {
    return async (config: InternalAxiosRequestConfig) => {
      this.lastRequestConfig = config;
      const url = config.url || '';

      if (this.options.simulateTimeout) {
        const timeoutError = new Error('Nacos 集群节点连接超时 (ETIMEDOUT)') as any;
        timeoutError.code = 'ETIMEDOUT';
        timeoutError.isAxiosError = true;
        throw timeoutError;
      }

      // 1. 模拟 401 鉴权拦截场景
      if (this.authFailuresRemaining > 0 && !url.includes('/v1/auth/login')) {
        this.authFailuresRemaining--;
        const err = new Error('Request failed with status code 401') as any;
        err.response = {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
          data: { code: 401, message: 'Token expired or invalid' },
        };
        err.config = config;
        err.isAxiosError = true;
        throw err;
      }

      // 2. 模拟登录 API: POST /v1/auth/login
      if (url.includes('/v1/auth/login')) {
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            accessToken: 'refreshed-token-999',
            tokenTtl: 18000,
            globalAdmin: true,
          },
        };
      }

      // 3. 模拟命名空间全量列表: GET /v1/console/namespaces
      if (config.method?.toLowerCase() === 'get' && url.includes('/v1/console/namespaces')) {
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            code: 200,
            message: null,
            data: [...this.namespaces],
          },
        };
      }

      // 4. 模拟创建命名空间: POST /v1/console/namespaces
      if (config.method?.toLowerCase() === 'post' && url.includes('/v1/console/namespaces')) {
        const params = new URLSearchParams(typeof config.data === 'string' ? config.data : '');
        const customNamespaceId = params.get('customNamespaceId') || '';
        const namespaceName = params.get('namespaceName') || '';
        const namespaceDesc = params.get('namespaceDesc') || '';

        this.namespaces.push({
          namespace: customNamespaceId,
          namespaceShowName: namespaceName,
          namespaceDesc,
          quota: 200,
          configCount: 0,
          type: 2,
        });

        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: true,
        };
      }

      // 5. 模拟删除命名空间: DELETE /v1/console/namespaces
      if (config.method?.toLowerCase() === 'delete' && url.includes('/v1/console/namespaces')) {
        const namespaceId = config.params?.namespaceId;
        this.namespaces = this.namespaces.filter((item) => item.namespace !== namespaceId);

        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: true,
        };
      }

      // 6. 模拟配置管理 OpenAPI: GET /v1/cs/configs
      if (config.method?.toLowerCase() === 'get' && url.includes('/v1/cs/configs')) {
        const search = config.params?.search;
        const tenant = config.params?.tenant ?? '';
        const dataId = config.params?.dataId;
        const group = config.params?.group || 'DEFAULT_GROUP';

        // 6.1 分页模糊搜索: search=blur
        if (search === 'blur') {
          let filtered = this.configs.filter((item) => item.tenant === tenant);
          if (dataId) {
            filtered = filtered.filter((item) => item.dataId.includes(dataId));
          }
          if (group && group !== 'DEFAULT_GROUP') {
            filtered = filtered.filter((item) => item.group.includes(group));
          }
          const appName = config.params?.appName;
          if (appName) {
            filtered = filtered.filter((item) => item.appName?.includes(appName));
          }

          const pageNo = Number(config.params?.pageNo) || 1;
          const pageSize = Number(config.params?.pageSize) || 20;
          const startIndex = (pageNo - 1) * pageSize;
          const pageItems = filtered.slice(startIndex, startIndex + pageSize);

          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            data: {
              totalCount: filtered.length,
              pageNumber: pageNo,
              pagesAvailable: Math.ceil(filtered.length / pageSize) || 1,
              pageItems,
            },
          };
        }

        // 6.2 依据 dataId & group 单个查询
        const found = this.configs.find(
          (c) => c.dataId === dataId && c.group === group && c.tenant === tenant
        );

        if (found) {
          return {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'text/plain' },
            config,
            data: found.content,
          };
        }

        const err = new Error('config data not exist') as any;
        err.response = {
          status: 404,
          statusText: 'Not Found',
          headers: {},
          config,
          data: 'config data not exist',
        };
        err.config = config;
        err.isAxiosError = true;
        throw err;
      }

      // 7. 模拟配置发布/更新: POST /v1/cs/configs
      if (config.method?.toLowerCase() === 'post' && url.includes('/v1/cs/configs')) {
        const params = new URLSearchParams(typeof config.data === 'string' ? config.data : '');
        const dataId = params.get('dataId') || '';
        const group = params.get('group') || 'DEFAULT_GROUP';
        const tenant = params.get('tenant') ?? '';
        const content = params.get('content') || '';
        const type = params.get('type') || 'text';
        const desc = params.get('desc') || '';
        const appName = params.get('appName') || '';

        const existingIndex = this.configs.findIndex(
          (c) => c.dataId === dataId && c.group === group && c.tenant === tenant
        );

        if (existingIndex >= 0) {
          this.configs[existingIndex] = {
            dataId,
            group,
            tenant,
            content,
            type,
            desc,
            appName,
          };
        } else {
          this.configs.push({
            dataId,
            group,
            tenant,
            content,
            type,
            desc,
            appName,
          });
        }

        // 记录历史快照
        const newHistoryId = 100 + this.history.length + 1;
        this.history.push({
          id: newHistoryId,
          dataId,
          group,
          tenant,
          content,
          appName,
          md5: `md5-${Date.now()}`,
          opType: existingIndex >= 0 ? 'U' : 'I',
          createdTime: new Date().toISOString(),
          lastModifiedTime: new Date().toISOString(),
        });

        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: true,
        };
      }

      // 8. 模拟删除配置: DELETE /v1/cs/configs
      if (config.method?.toLowerCase() === 'delete' && url.includes('/v1/cs/configs')) {
        const dataId = config.params?.dataId;
        const group = config.params?.group || 'DEFAULT_GROUP';
        const tenant = config.params?.tenant ?? '';

        this.configs = this.configs.filter(
          (c) => !(c.dataId === dataId && c.group === group && c.tenant === tenant)
        );

        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: true,
        };
      }

      // 9. 模拟历史配置管理: GET /v1/cs/history
      if (config.method?.toLowerCase() === 'get' && url.includes('/v1/cs/history')) {
        const nid = config.params?.nid;
        const dataId = config.params?.dataId;
        const group = config.params?.group || 'DEFAULT_GROUP';
        const tenant = config.params?.tenant ?? '';

        // 9.1 查询特定历史快照详情: nid
        if (nid !== undefined && nid !== null && String(nid) !== '') {
          const found = this.history.find(
            (h) => String(h.id) === String(nid) && h.dataId === dataId && h.group === group && h.tenant === tenant
          );

          if (found) {
            return {
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
              data: found,
            };
          }

          const err = new Error('history config not found') as any;
          err.response = {
            status: 404,
            statusText: 'Not Found',
            headers: {},
            config,
            data: 'history config not found',
          };
          err.config = config;
          err.isAxiosError = true;
          throw err;
        }

        // 9.2 查询配置的历史版本列表
        const filtered = this.history.filter(
          (h) => h.dataId === dataId && h.group === group && h.tenant === tenant
        );

        const pageNo = Number(config.params?.pageNo) || 1;
        const pageSize = Number(config.params?.pageSize) || 20;
        const startIndex = (pageNo - 1) * pageSize;
        const pageItems = filtered.slice(startIndex, startIndex + pageSize);

        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            totalCount: filtered.length,
            pageNumber: pageNo,
            pagesAvailable: Math.ceil(filtered.length / pageSize) || 1,
            pageItems,
          },
        };
      }

      return {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
        data: { message: `Mock route not found: ${config.method} ${url}` },
      };
    };
  }
}
