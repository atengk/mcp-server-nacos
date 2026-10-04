# 智能体协同准则 (Agents Guide)

本文件为智能体（AI Agent）在本代码库中执行任务提供基础配置指引、行为约束与执行交付工作流规范。

---

## 1. 智能体技能配置 (Agent skills)

### Issue 跟踪器
本项目的缺陷（Bug）、功能需求与开发任务全部托管于 GitHub Issues，使用 `gh` 命令行工具进行交互与状态维护。详见 [docs/agents/issue-tracker.md](./docs/agents/issue-tracker.md)。

### 分诊标签词汇表
遵循 5 种标准问题分诊角色标签（`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`）进行任务流转与状态管理。详见 [docs/agents/triage-labels.md](./docs/agents/triage-labels.md)。

### 领域与决策文档
采用单上下文（Single-Context）架构，包含根目录 `CONTEXT.md`（核心业务统一语言）与架构决策记录目录 `docs/adr/`（技术决策历史）。详见 [docs/agents/domain.md](./docs/agents/domain.md)。

---

## 2. 智能体任务执行与交付工作流规范 (Workflow & TDD)

### 任务认领与状态流转
1. **目标任务锁定**：智能体执行开发时，优先从 GitHub 获取处于开放状态且标记为 `ready-for-agent` 的切片任务（如 `#2`、`#3` 等），按依赖拓扑顺序推进；
2. **术语与决策检查**：开工前必读 [CONTEXT.md](./CONTEXT.md) 与 [docs/adr/](./docs/adr/)，严禁在代码或测试中引入未定义的模糊新词，严禁违反已有 ADR 决策。

### 测试驱动开发 (TDD) 与最高接缝准则
1. **最高测试接缝 (Highest Testing Seam)**：测试全部收敛在 **MCP 工具分发入口（Tool Dispatch Seam）**，通过模拟工具请求输入，断言响应内容与错误标识；
2. **外部行为黑盒验证**：严禁针对内部私有小方法编写脆性测试；只测试入参校验、语法守卫拦截、参数清洗、返回截断及自愈重试等可见行为；
3. **红-绿-重构循环**：先根据 Acceptance Criteria 编写失败的黑盒测试（Red），再实现领域处理器与客户端最小代码（Green），最后优化重构（Refactor）。

### 质量红线与防御性设计
- **无状态设计**：单例工具处理器严禁持有可变业务状态；
- **强类型守卫**：所有 MCP Tools 入参必须经由 Zod Schema 严格校验并输出人类可读的语义描述；
- **异常收敛**：网络抖动与 Nacos 异常统一包装为语义化错误文本，严禁抛出未捕获的未处理异常导致 Stdio 进程崩溃。

### 提交与自动关单规范
1. 代码修改完成后，必须执行 `pnpm run typecheck` 与 `pnpm test` 确保全绿灯；
2. 遵循 Conventional Commits 提交规范，并在 Commit 信息末尾包含对应的关联关单指令（例如 `feat: 实现命名空间端到端原子工具 (close #2)`）。
