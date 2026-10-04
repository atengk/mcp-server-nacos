/**
 * Nacos 3.0 OpenAPI 核心业务客户端门面
 *
 * @author Ateng
 * @since 2026-10-04
 */

import type {
  NacosApiResponse,
  NacosConfig,
  NacosConfigHistoryItem,
  NacosConfigHistoryListResult,
  NacosConfigListResult,
  NacosNamespace,
  NacosServerConfig,
} from '../types/index.js';
import type { HttpClient } from './http.client.js';

export class NacosClient {
  public readonly config: NacosServerConfig;
  public readonly httpClient: HttpClient;

  /**
   * 初始化 Nacos OpenAPI 客户端
   *
   * @param config 系统运行配置
   * @param httpClient 底层 HTTP 客户端
   */
  constructor(config: NacosServerConfig, httpClient: HttpClient) {
    this.config = config;
    this.httpClient = httpClient;
  }

  /**
   * 查询命名空间全量列表
   *
   * @return 命名空间实体列表，无匹配项时保证返回空集合
   * @throws Error 请求失败或服务端异常时抛出
   */
  public async listNamespaces(): Promise<NacosNamespace[]> {
    const response = await this.httpClient.get<
      NacosApiResponse<NacosNamespace[]> | NacosNamespace[]
    >('/v1/console/namespaces');

    if (Array.isArray(response.data)) {
      return response.data;
    }

    if (response.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }

    return [];
  }

  /**
   * 创建新的命名空间
   *
   * @param namespaceId 租户唯一标识符 (customNamespaceId)
   * @param namespaceName 命名空间显示名称
   * @param namespaceDesc 命名空间用途描述
   * @return 是否创建成功
   * @throws Error 当创建失败时抛出错误说明
   */
  public async createNamespace(
    namespaceId: string,
    namespaceName: string,
    namespaceDesc = ''
  ): Promise<boolean> {
    const formParams = new URLSearchParams();
    formParams.append('customNamespaceId', namespaceId);
    formParams.append('namespaceName', namespaceName);
    formParams.append('namespaceDesc', namespaceDesc);

    const response = await this.httpClient.post<NacosApiResponse<boolean> | boolean>(
      '/v1/console/namespaces',
      formParams.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (typeof response.data === 'boolean') {
      return response.data;
    }

    if (response.data && typeof response.data.data === 'boolean') {
      return response.data.data;
    }

    return true;
  }

  /**
   * 删除指定的命名空间
   *
   * @param namespaceId 待删除的命名空间 Tenant ID
   * @return 是否删除成功
   * @throws Error 当删除失败时抛出异常
   */
  public async deleteNamespace(namespaceId: string): Promise<boolean> {
    const response = await this.httpClient.delete<NacosApiResponse<boolean> | boolean>(
      '/v1/console/namespaces',
      {
        params: {
          namespaceId,
        },
      }
    );

    if (typeof response.data === 'boolean') {
      return response.data;
    }

    if (response.data && typeof response.data.data === 'boolean') {
      return response.data.data;
    }

    return true;
  }

  /**
   * 获取指定配置项全文内容
   *
   * @param dataId 配置集 ID
   * @param group 配置分组（默认 DEFAULT_GROUP）
   * @param tenant 命名空间 Tenant ID（空字符串为公共空间）
   * @return 配置文本全文
   * @throws Error 当配置不存在或网络异常时抛出
   */
  public async getConfig(
    dataId: string,
    group = 'DEFAULT_GROUP',
    tenant = ''
  ): Promise<string> {
    try {
      const response = await this.httpClient.get<string>('/v1/cs/configs', {
        params: {
          dataId,
          group,
          tenant,
        },
        responseType: 'text',
      });

      if (response.data === undefined || response.data === null) {
        return '';
      }

      return typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.status === 404) {
        throw new Error(
          `配置项不存在: dataId=${dataId}, group=${group}, namespaceId=${tenant || 'public'}`
        );
      }
      throw err;
    }
  }

  /**
   * 发布或更新配置内容
   *
   * @param params 发布参数（包含 dataId, group, tenant, content, type, desc, appName）
   * @return 是否发布成功
   * @throws Error 当发布失败时抛出异常
   */
  public async publishConfig(params: {
    dataId: string;
    group?: string;
    tenant?: string;
    content: string;
    type?: string;
    desc?: string;
    appName?: string;
  }): Promise<boolean> {
    const formParams = new URLSearchParams();
    formParams.append('dataId', params.dataId);
    formParams.append('group', params.group || 'DEFAULT_GROUP');
    formParams.append('tenant', params.tenant ?? '');
    formParams.append('content', params.content);
    formParams.append('type', params.type || 'text');

    if (params.desc) {
      formParams.append('desc', params.desc);
    }
    if (params.appName) {
      formParams.append('appName', params.appName);
    }

    const response = await this.httpClient.post<NacosApiResponse<boolean> | boolean>(
      '/v1/cs/configs',
      formParams.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (typeof response.data === 'boolean') {
      return response.data;
    }

    if (response.data && typeof response.data.data === 'boolean') {
      return response.data.data;
    }

    return true;
  }

  /**
   * 删除指定配置项
   *
   * @param dataId 配置集 ID
   * @param group 配置分组（默认 DEFAULT_GROUP）
   * @param tenant 命名空间 Tenant ID（空字符串为公共空间）
   * @return 是否删除成功
   * @throws Error 当删除失败时抛出异常
   */
  public async deleteConfig(
    dataId: string,
    group = 'DEFAULT_GROUP',
    tenant = ''
  ): Promise<boolean> {
    const response = await this.httpClient.delete<NacosApiResponse<boolean> | boolean>(
      '/v1/cs/configs',
      {
        params: {
          dataId,
          group,
          tenant,
        },
      }
    );

    if (typeof response.data === 'boolean') {
      return response.data;
    }

    if (response.data && typeof response.data.data === 'boolean') {
      return response.data.data;
    }

    return true;
  }

  /**
   * 分页模糊搜索配置项列表
   *
   * @param params 搜索与分页条件
   * @return 配置列表与分页元数据
   */
  public async listConfigs(params: {
    dataId?: string;
    group?: string;
    appName?: string;
    tenant?: string;
    pageNo?: number;
    pageSize?: number;
  }): Promise<NacosConfigListResult> {
    const response = await this.httpClient.get<
      NacosApiResponse<NacosConfigListResult> | NacosConfigListResult
    >('/v1/cs/configs', {
      params: {
        search: 'blur',
        dataId: params.dataId || '',
        group: params.group || '',
        appName: params.appName || '',
        tenant: params.tenant ?? '',
        pageNo: params.pageNo || 1,
        pageSize: params.pageSize || 20,
      },
    });

    const payload = (response.data as any)?.data ?? response.data;

    if (!payload) {
      return {
        totalCount: 0,
        pageNumber: params.pageNo || 1,
        pagesAvailable: 0,
        pageItems: [],
      };
    }

    return {
      totalCount: payload.totalCount ?? 0,
      pageNumber: payload.pageNumber ?? params.pageNo ?? 1,
      pagesAvailable: payload.pagesAvailable ?? 0,
      pageItems: Array.isArray(payload.pageItems) ? payload.pageItems : [],
    };
  }

  /**
   * 分页查询配置的历史版本清单
   *
   * @param params 查询条件
   * @return 历史版本列表与分页元数据
   */
  public async getConfigHistory(params: {
    dataId: string;
    group?: string;
    tenant?: string;
    pageNo?: number;
    pageSize?: number;
  }): Promise<NacosConfigHistoryListResult> {
    const response = await this.httpClient.get<
      NacosApiResponse<NacosConfigHistoryListResult> | NacosConfigHistoryListResult
    >('/v1/cs/history', {
      params: {
        search: 'accurate',
        dataId: params.dataId,
        group: params.group || 'DEFAULT_GROUP',
        tenant: params.tenant ?? '',
        pageNo: params.pageNo || 1,
        pageSize: params.pageSize || 20,
      },
    });

    const payload = (response.data as any)?.data ?? response.data;

    if (!payload) {
      return {
        totalCount: 0,
        pageNumber: params.pageNo || 1,
        pagesAvailable: 0,
        pageItems: [],
      };
    }

    return {
      totalCount: payload.totalCount ?? 0,
      pageNumber: payload.pageNumber ?? params.pageNo ?? 1,
      pagesAvailable: payload.pagesAvailable ?? 0,
      pageItems: Array.isArray(payload.pageItems) ? payload.pageItems : [],
    };
  }

  /**
   * 获取指定历史版本的快照详情
   *
   * @param params 寻址与快照 ID 参数
   * @return 历史快照详细记录
   * @throws Error 快照不存在或请求异常时抛出
   */
  public async getConfigHistoryDetail(params: {
    dataId: string;
    group?: string;
    tenant?: string;
    historyId: string | number;
  }): Promise<NacosConfigHistoryItem> {
    try {
      const response = await this.httpClient.get<
        NacosApiResponse<NacosConfigHistoryItem> | NacosConfigHistoryItem
      >('/v1/cs/history', {
        params: {
          nid: params.historyId,
          dataId: params.dataId,
          group: params.group || 'DEFAULT_GROUP',
          tenant: params.tenant ?? '',
        },
      });

      const payload = (response.data as any)?.data ?? response.data;
      if (!payload || !payload.content) {
        throw new Error(`历史版本快照不存在: historyId=${params.historyId}`);
      }

      return payload;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.status === 404) {
        throw new Error(`历史版本快照不存在: historyId=${params.historyId}`);
      }
      throw err;
    }
  }

  /**
   * 原子化回滚配置到指定历史版本
   *
   * 自动提取快照全文并原子发布覆盖当前运行配置，杜绝模型搬运截断风险。
   *
   * @param params 回滚目标参数
   * @return 回滚应用的快照信息
   */
  public async rollbackConfig(params: {
    dataId: string;
    group?: string;
    tenant?: string;
    historyId: string | number;
  }): Promise<NacosConfigHistoryItem> {
    const group = params.group || 'DEFAULT_GROUP';
    const tenant = params.tenant ?? '';

    // 1. 获取目标历史快照完整元数据及全文内容
    const snapshot = await this.getConfigHistoryDetail({
      dataId: params.dataId,
      group,
      tenant,
      historyId: params.historyId,
    });

    if (snapshot.content === undefined || snapshot.content === null) {
      throw new Error(`历史版本快照内容为空，无法执行回滚: historyId=${params.historyId}`);
    }

    // 2. 原子发布覆盖当前运行配置
    await this.publishConfig({
      dataId: params.dataId,
      group,
      tenant,
      content: snapshot.content,
      appName: snapshot.appName,
      desc: `Rollback to history snapshot #${params.historyId}`,
    });

    return snapshot;
  }
}

