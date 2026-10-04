# 智能体协同准则 (Agents Guide)

本文件为智能体（AI Agent）在本代码库中执行任务提供基础配置指引与行为约束。

## 智能体技能配置 (Agent skills)

### Issue 跟踪器
本项目的缺陷（Bug）、功能需求与开发任务全部托管于 GitHub Issues，使用 `gh` 命令行工具进行交互与状态维护。详见 [docs/agents/issue-tracker.md](./docs/agents/issue-tracker.md)。

### 分诊标签词汇表
遵循 5 种标准问题分诊角色标签（`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`）进行任务流转与状态管理。详见 [docs/agents/triage-labels.md](./docs/agents/triage-labels.md)。

### 领域与决策文档
采用单上下文（Single-Context）架构，包含根目录 `CONTEXT.md`（核心业务统一语言）与架构决策记录目录 `docs/adr/`（技术决策历史）。详见 [docs/agents/domain.md](./docs/agents/domain.md)。
