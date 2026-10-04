/**
 * MCP Prompts 交互式运维模板领域处理器
 *
 * 负责组装微服务拓扑与异常节点体检、配置漂移对比与 Unified Git Diff 生成。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import type { NacosClient } from '../client/nacos.client.js';
import { generateUnifiedDiff } from '../utils/diff.util.js';
import { normalizeNamespaceId } from '../utils/normalizer.js';

export interface ServiceInspectionInput {
  namespaceId?: string;
  groupName?: string;
}

export interface ConfigDriftCheckInput {
  dataId: string;
  group?: string;
  namespaceId?: string;
  historyId?: string | number;
}

export class PromptHandler {
  /**
   * 生成微服务拓扑与健康度体检 Prompts 模板
   *
   * 自动遍历当前命名空间及分组下的所有微服务与注册实例，统计健康度分布，
   * 标注异常与隔离下线节点，为大模型生成全景体检分析引导上下文。
   *
   * @param client Nacos 核心客户端
   * @param input 体检过滤入参
   * @return MCP 标准 GetPromptResult
   */
  public static async serviceInspectionPrompt(
    client: NacosClient,
    input: ServiceInspectionInput = {}
  ): Promise<GetPromptResult> {
    const namespaceId = normalizeNamespaceId(input.namespaceId);
    const groupName = input.groupName || 'DEFAULT_GROUP';

    // 1. 获取微服务全量列表
    const servicesResult = await client.listServices({
      namespaceId,
      groupName,
      pageNo: 1,
      pageSize: 100,
    });

    const serviceNames = servicesResult.doms;
    let totalInstances = 0;
    let healthyInstances = 0;
    let unhealthyInstances = 0;
    let disabledInstances = 0;

    const serviceDetails: string[] = [];

    // 2. 遍历服务获取实例拓扑与健康数据
    for (const sName of serviceNames) {
      const instancesResult = await client.listInstances({
        serviceName: sName,
        namespaceId,
        groupName,
        healthyOnly: false,
      });

      const hosts = instancesResult.hosts;
      totalInstances += hosts.length;

      const hostLines: string[] = [];
      for (const h of hosts) {
        if (!h.healthy) unhealthyInstances++;
        else healthyInstances++;
        if (!h.enabled) disabledInstances++;

        const healthTag = h.healthy ? '健康' : '异常';
        const enableTag = h.enabled ? '在线' : '隔离下线';
        const nodeType = h.ephemeral ? '临时' : '持久化';

        hostLines.push(
          `  - 实例: \`${h.ip}:${h.port}\` | 状态: [${healthTag}] | 流量: [${enableTag}] | 权重: ${h.weight} | 模式: ${nodeType} | 集群: ${h.clusterName || 'DEFAULT'}`
        );
      }

      serviceDetails.push(
        `### 服务: \`${sName}\` (共 ${hosts.length} 个实例)\n${hostLines.length > 0 ? hostLines.join('\n') : '  - 暂无注册实例'}`
      );
    }

    const reportContent = [
      '# Nacos 微服务架构健康度与拓扑体检报告',
      '',
      `## 1. 巡检环境元数据`,
      `- **命名空间 (Tenant)**: \`${namespaceId || 'public'}\``,
      `- **服务分组 (Group)**: \`${groupName}\``,
      `- **微服务总数**: ${serviceNames.length} 个`,
      `- **注册实例总数**: ${totalInstances} 个`,
      `- **健康实例数**: ${healthyInstances} 个`,
      `- **异常实例数**: ${unhealthyInstances} 个`,
      `- **隔离下线数**: ${disabledInstances} 个`,
      '',
      '## 2. 微服务与节点拓扑明细',
      serviceDetails.length > 0
        ? serviceDetails.join('\n\n')
        : '当前环境暂未发现任何已注册微服务。',
      '',
      '## 3. 大模型分析与诊断任务要求',
      '请根据上述采集到的 Nacos 微服务实时拓扑与节点健康度数据，执行以下深度体检分析：',
      '1. **健康度评估**：针对标记为【异常】或【隔离下线】的实例节点进行故障影响面评估；',
      '2. **高可用与冗余性分析**：评估是否存在单节点脆弱性或集群分布不均问题；',
      '3. **运维处置建议**：给出针对性的排查思路与处置操作建议（例如通过 `nacos_update_instance` 调节权重隔离、通过 `nacos_deregister_instance` 摘除故障节点或恢复健康节点）。',
    ].join('\n');

    return {
      description: 'Nacos 微服务拓扑与健康度体检分析报告',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: reportContent,
          },
        },
      ],
    };
  }

  /**
   * 生成配置漂移比对与 Unified Git Diff 分析 Prompts 模板
   *
   * 对比当前线上运行配置与历史版本快照，输出标准 Git Diff，
   * 引导大模型分析配置参数变动风险并提供回滚指导。
   *
   * @param client Nacos 核心客户端
   * @param input 漂移比对入参
   * @return MCP 标准 GetPromptResult
   */
  public static async configDriftCheckPrompt(
    client: NacosClient,
    input: ConfigDriftCheckInput
  ): Promise<GetPromptResult> {
    const tenant = normalizeNamespaceId(input.namespaceId);
    const group = input.group || 'DEFAULT_GROUP';
    const dataId = input.dataId.trim();

    // 1. 获取当前运行配置
    const currentContent = await client.getConfig(dataId, group, tenant);
    if (currentContent === null || currentContent === undefined) {
      throw new Error(
        `当前运行配置集不存在: dataId=${dataId}, group=${group}, namespaceId=${tenant || 'public'}`
      );
    }

    // 2. 获取对比的目标历史快照
    let historySnapshot: {
      id?: string | number;
      content: string;
      lastModifiedTime?: string;
      srcUser?: string;
      opType?: string;
    } | null = null;

    if (input.historyId !== undefined && input.historyId !== '') {
      const detail = await client.getConfigHistoryDetail({
        dataId,
        group,
        tenant,
        historyId: input.historyId,
      });
      historySnapshot = {
        id: detail.id || input.historyId,
        content: detail.content || '',
        lastModifiedTime: detail.lastModifiedTime,
        srcUser: detail.srcUser,
        opType: detail.opType,
      };
    } else {
      // 自动拉取最近历史版本列表
      const historyList = await client.getConfigHistory({
        dataId,
        group,
        tenant,
        pageNo: 1,
        pageSize: 5,
      });

      const items = historyList.pageItems;
      if (items.length > 0) {
        // 若最新一项与当前内容一致，且有前序版本，则对比前序版本
        let target = items[0];
        if (items.length > 1 && items[0].content === currentContent) {
          target = items[1];
        }

        // 若历史列表内容缺失则补查详情
        if (target.content === undefined || target.content === null) {
          const detail = await client.getConfigHistoryDetail({
            dataId,
            group,
            tenant,
            historyId: target.id || 0,
          });
          target = detail;
        }

        historySnapshot = {
          id: target.id,
          content: target.content || '',
          lastModifiedTime: target.lastModifiedTime,
          srcUser: target.srcUser,
          opType: target.opType,
        };
      }
    }

    // 3. 计算 Unified Git Diff
    const historyContent = historySnapshot?.content ?? '';
    const historyIdLabel = historySnapshot?.id ? `#${historySnapshot.id}` : '无快照';
    const diffText = generateUnifiedDiff(historyContent, currentContent, {
      oldHeader: `a/history (${historyIdLabel})`,
      newHeader: `b/current (运行中最新配置)`,
      contextLines: 3,
    });

    const reportContent = [
      '# Nacos 配置漂移比对与变更风险评估报告',
      '',
      '## 1. 配置寻址信息',
      `- **配置集 ID (Data ID)**: \`${dataId}\``,
      `- **配置分组 (Group)**: \`${group}\``,
      `- **命名空间 (Tenant)**: \`${tenant || 'public'}\``,
      `- **对比历史快照 ID**: \`${historyIdLabel}\``,
      `- **快照修改时间**: ${historySnapshot?.lastModifiedTime || '未知'}`,
      `- **快照操作人**: ${historySnapshot?.srcUser || '未知'}`,
      '',
      '## 2. Unified Git Diff 差异补丁',
      '```diff',
      diffText,
      '```',
      '',
      '## 3. 大模型漂移风险评估任务要求',
      '请根据上述 Unified Git Diff 变动内容，执行细致的配置漂移风险评估：',
      '1. **变更意图识别**：总结本次配置漂移的核心变动（关键字段的修改、新增或删除）；',
      '2. **高危风险审查**：检查端口冲突、网络超时设置、线程池水位、数据库连接串及网关路由变更等潜在生产故障点；',
      '3. **发布与回滚决策**：',
      '   - 若评估结果安全，确认放行上线；',
      '   - 若存在风险或配置破坏，建议使用 `nacos_rollback_config` 原子工具回滚至快照版本：',
      `     \`\`\`json`,
      `     { "dataId": "${dataId}", "group": "${group}", "namespaceId": "${tenant}", "historyId": "${historySnapshot?.id || ''}" }`,
      `     \`\`\``,
    ].join('\n');

    return {
      description: 'Nacos 配置漂移比对与变更风险评估',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: reportContent,
          },
        },
      ],
    };
  }
}
