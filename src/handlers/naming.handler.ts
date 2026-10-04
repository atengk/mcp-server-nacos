/**
 * 微服务发现与实例动态治理领域处理器
 *
 * 负责服务列表分页查询、服务元数据与保护阈值检视、实例双模（持久化/临时）注册、
 * 实例注销、权重与上下线动态调节、以及集群节点状态探测。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import type { NacosClient } from '../client/nacos.client.js';

export interface ListServicesInput {
  groupName?: string;
  namespaceId?: string;
  pageNo?: number;
  pageSize?: number;
}

export interface GetServiceInput {
  serviceName: string;
  groupName?: string;
  namespaceId?: string;
}

export interface ListInstancesInput {
  serviceName: string;
  groupName?: string;
  namespaceId?: string;
  healthyOnly?: boolean;
  clusters?: string;
}

export interface RegisterInstanceInput {
  serviceName: string;
  ip: string;
  port: number;
  groupName?: string;
  namespaceId?: string;
  weight?: number;
  enabled?: boolean;
  healthy?: boolean;
  ephemeral?: boolean;
  clusterName?: string;
  metadata?: Record<string, string>;
}

export interface DeregisterInstanceInput {
  serviceName: string;
  ip: string;
  port: number;
  groupName?: string;
  namespaceId?: string;
  clusterName?: string;
  ephemeral?: boolean;
}

export interface UpdateInstanceInput {
  serviceName: string;
  ip: string;
  port: number;
  groupName?: string;
  namespaceId?: string;
  weight?: number;
  enabled?: boolean;
  clusterName?: string;
  metadata?: Record<string, string>;
  ephemeral?: boolean;
}

export class NamingHandler {
  /**
   * 处理微服务列表分页查询
   *
   * @param client Nacos 核心客户端
   * @param input 查询入参
   * @return 格式化后的微服务列表摘要
   */
  public static async listServices(
    client: NacosClient,
    input: ListServicesInput = {}
  ): Promise<string> {
    const result = await client.listServices({
      groupName: input.groupName,
      namespaceId: input.namespaceId,
      pageNo: input.pageNo,
      pageSize: input.pageSize,
    });

    if (result.doms.length === 0) {
      return `当前命名空间/分组下暂无已注册的微服务。(命名空间: ${input.namespaceId || 'public'}, 分组: ${input.groupName || 'DEFAULT_GROUP'})`;
    }

    const lines: string[] = [
      `### Nacos 微服务列表 (共 ${result.count} 个)`,
      `- **命名空间 (Tenant)**: \`${input.namespaceId || 'public'}\``,
      `- **服务分组 (Group)**: \`${input.groupName || 'DEFAULT_GROUP'}\``,
      '',
      '| 序号 | 微服务名称 (Service Name) |',
      '| :--- | :--- |',
    ];

    result.doms.forEach((name, index) => {
      lines.push(`| ${index + 1} | ${name} |`);
    });

    return lines.join('\n');
  }

  /**
   * 处理微服务详情与保护阈值检视
   *
   * @param client Nacos 核心客户端
   * @param input 服务详情入参
   * @return 格式化后的服务元数据与配置
   */
  public static async getService(
    client: NacosClient,
    input: GetServiceInput
  ): Promise<string> {
    const detail = await client.getService(
      input.serviceName.trim(),
      input.groupName,
      input.namespaceId
    );

    const metadataStr =
      detail.metadata && Object.keys(detail.metadata).length > 0
        ? `\`${JSON.stringify(detail.metadata)}\``
        : '无';

    return [
      `### Nacos 微服务详情: \`${detail.name}\``,
      `- **所属分组 (Group)**: \`${detail.groupName || input.groupName || 'DEFAULT_GROUP'}\``,
      `- **命名空间 (Tenant)**: \`${input.namespaceId || 'public'}\``,
      `- **保护阈值 (Protect Threshold)**: ${detail.protectThreshold}`,
      `- **集群配置数**: ${detail.clusters?.length ?? 0}`,
      `- **路由选择器 (Selector)**: ${detail.selector?.type || '无'}`,
      `- **服务元数据**: ${metadataStr}`,
    ].join('\n');
  }

  /**
   * 处理实例列表查询（支持按健康状态过滤）
   *
   * @param client Nacos 核心客户端
   * @param input 实例过滤入参
   * @return 格式化后的实例列表表格
   */
  public static async listInstances(
    client: NacosClient,
    input: ListInstancesInput
  ): Promise<string> {
    const result = await client.listInstances({
      serviceName: input.serviceName.trim(),
      groupName: input.groupName,
      namespaceId: input.namespaceId,
      healthyOnly: input.healthyOnly,
      clusters: input.clusters,
    });

    if (result.hosts.length === 0) {
      return `微服务 "${input.serviceName}" 在当前过滤条件下暂无注册实例。(健康过滤: ${input.healthyOnly ? '仅健康' : '全部'})`;
    }

    const lines: string[] = [
      `### Nacos 服务实例列表: \`${result.name}\` (共 ${result.hosts.length} 个实例)`,
      `- **所属分组 (Group)**: \`${result.groupName || input.groupName || 'DEFAULT_GROUP'}\``,
      `- **健康状态过滤**: ${input.healthyOnly ? '仅健康实例 (Healthy Only)' : '全量实例 (All)'}`,
      '',
      '| 实例地址 (IP:Port) | 权重 (Weight) | 健康状态 | 在线状态 | 节点类型 | 集群 (Cluster) | 元数据 (Metadata) |',
      '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
    ];

    for (const host of result.hosts) {
      const addr = `${host.ip}:${host.port}`;
      const weight = host.weight;
      const healthyBadge = host.healthy ? '✅ 健康' : '❌ 异常';
      const enabledBadge = host.enabled ? '✅ 在线' : '⏸️ 隔离下线';
      const nodeType = host.ephemeral ? '临时节点' : '持久化节点';
      const cluster = host.clusterName || 'DEFAULT';
      const metadataStr =
        host.metadata && Object.keys(host.metadata).length > 0
          ? `\`${JSON.stringify(host.metadata)}\``
          : '-';

      lines.push(
        `| ${addr} | ${weight} | ${healthyBadge} | ${enabledBadge} | ${nodeType} | ${cluster} | ${metadataStr} |`
      );
    }

    return lines.join('\n');
  }

  /**
   * 处理微服务实例注册（双模支持，默认持久化）
   *
   * @param client Nacos 核心客户端
   * @param input 实例注册入参
   * @return 操作结果说明
   */
  public static async registerInstance(
    client: NacosClient,
    input: RegisterInstanceInput
  ): Promise<string> {
    // 依据 ADR-0002 规范：默认采用持久化模式 (ephemeral=false)
    const isEphemeral = input.ephemeral === true;

    await client.registerInstance({
      serviceName: input.serviceName.trim(),
      ip: input.ip.trim(),
      port: input.port,
      groupName: input.groupName,
      namespaceId: input.namespaceId,
      weight: input.weight,
      enabled: input.enabled,
      healthy: input.healthy,
      ephemeral: isEphemeral,
      clusterName: input.clusterName,
      metadata: input.metadata,
    });

    const nodeTypeDesc = isEphemeral ? '临时节点 (Ephemeral)' : '持久化节点 (Persistent)';
    const enabledDesc = input.enabled !== false ? '已启用 (Enabled)' : '已下线 (Disabled)';
    const healthyDesc = input.healthy !== false ? '健康 (Healthy)' : '异常 (Unhealthy)';

    return [
      `✅ 服务实例注册成功！`,
      `- **微服务名称**: \`${input.serviceName.trim()}\``,
      `- **实例地址**: \`${input.ip.trim()}:${input.port}\``,
      `- **节点类型**: ${nodeTypeDesc}`,
      `- **流量权重**: ${input.weight ?? 1.0}`,
      `- **启用状态**: ${enabledDesc}`,
      `- **健康状态**: ${healthyDesc}`,
      `- **所属集群**: \`${input.clusterName || 'DEFAULT'}\``,
      `- **服务分组**: \`${input.groupName || 'DEFAULT_GROUP'}\``,
      `- **命名空间**: \`${input.namespaceId || 'public'}\``,
    ].join('\n');
  }

  /**
   * 处理微服务实例注销
   *
   * @param client Nacos 核心客户端
   * @param input 注销入参
   * @return 操作结果说明
   */
  public static async deregisterInstance(
    client: NacosClient,
    input: DeregisterInstanceInput
  ): Promise<string> {
    await client.deregisterInstance({
      serviceName: input.serviceName.trim(),
      ip: input.ip.trim(),
      port: input.port,
      groupName: input.groupName,
      namespaceId: input.namespaceId,
      clusterName: input.clusterName,
      ephemeral: input.ephemeral,
    });

    return [
      `✅ 服务实例注销成功！`,
      `- **微服务名称**: \`${input.serviceName.trim()}\``,
      `- **实例地址**: \`${input.ip.trim()}:${input.port}\``,
      `- **服务分组**: \`${input.groupName || 'DEFAULT_GROUP'}\``,
      `- **命名空间**: \`${input.namespaceId || 'public'}\``,
      `- **所属集群**: \`${input.clusterName || 'DEFAULT'}\``,
    ].join('\n');
  }

  /**
   * 处理微服务实例配置更新（权重调节、上线/隔离下线）
   *
   * @param client Nacos 核心客户端
   * @param input 实例更新入参
   * @return 操作结果说明
   */
  public static async updateInstance(
    client: NacosClient,
    input: UpdateInstanceInput
  ): Promise<string> {
    await client.updateInstance({
      serviceName: input.serviceName.trim(),
      ip: input.ip.trim(),
      port: input.port,
      groupName: input.groupName,
      namespaceId: input.namespaceId,
      weight: input.weight,
      enabled: input.enabled,
      clusterName: input.clusterName,
      metadata: input.metadata,
      ephemeral: input.ephemeral,
    });

    const weightDesc = input.weight !== undefined ? String(input.weight) : '保持原样';
    const enabledDesc =
      input.enabled !== undefined
        ? input.enabled
          ? '启用 (Enabled)'
          : '隔离下线 (Disabled)'
        : '保持原样';

    return [
      `✅ 服务实例配置修改成功！`,
      `- **微服务名称**: \`${input.serviceName.trim()}\``,
      `- **实例地址**: \`${input.ip.trim()}:${input.port}\``,
      `- **流量权重**: ${weightDesc}`,
      `- **在线状态**: ${enabledDesc}`,
      `- **服务分组**: \`${input.groupName || 'DEFAULT_GROUP'}\``,
      `- **命名空间**: \`${input.namespaceId || 'public'}\``,
      `- **所属集群**: \`${input.clusterName || 'DEFAULT'}\``,
    ].join('\n');
  }

  /**
   * 处理 Nacos 集群节点健康度探针检视
   *
   * @param client Nacos 核心客户端
   * @return 格式化后的集群节点运行状态
   */
  public static async getServerStatus(client: NacosClient): Promise<string> {
    const servers = await client.getServerStatus();

    if (servers.length === 0) {
      return '未探测到可用的 Nacos 集群节点。';
    }

    const lines: string[] = [
      `### Nacos 集群节点运行状态 (共 ${servers.length} 个节点)`,
      '',
      '| 节点地址 (Address) | 节点状态 (Status) | Nacos 版本 (Version) | 运行模式 (Mode) | 详细信息 |',
      '| :--- | :--- | :--- | :--- | :--- |',
    ];

    for (const server of servers) {
      const addr = `${server.ip}:${server.port}`;
      const statusBadge = server.state === 'UP' ? '🟢 UP (健康)' : `🔴 ${server.state}`;
      const version = (server.extendInfo?.version as string) || '未知';
      const mode =
        server.extendInfo?.standaloneMode === true
          ? '单机模式 (Standalone)'
          : '集群模式 (Cluster)';
      const extendInfoStr =
        server.extendInfo && Object.keys(server.extendInfo).length > 0
          ? `\`${JSON.stringify(server.extendInfo)}\``
          : '-';

      lines.push(`| ${addr} | ${statusBadge} | ${version} | ${mode} | ${extendInfoStr} |`);
    }

    return lines.join('\n');
  }
}
