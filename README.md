# MCP Server for Nacos 3.0 (mcp-server-nacos)

<p align="center">
  <strong>基于 Nacos 3.0 控制面与 OpenAPI 打造的企业级 Model Context Protocol (MCP) 服务端 (v1.0.0 正式版 · Production Ready)</strong>
</p>

<p align="center">
  <a href="https://github.com/atengk/mcp-server-nacos/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/atengk/mcp-server-nacos/ci.yml?branch=main&label=CI&style=flat-square" alt="CI Status" />
  </a>
  <a href="https://github.com/atengk/mcp-server-nacos/releases">
    <img src="https://img.shields.io/github/v/release/atengk/mcp-server-nacos?style=flat-square" alt="Release" />
  </a>
  <a href="https://www.npmjs.com/package/@atengk/mcp-server-nacos">
    <img src="https://img.shields.io/npm/v/@atengk/mcp-server-nacos?style=flat-square&color=crimson" alt="npm version" />
  </a>
  <a href="https://ghcr.io/atengk/mcp-server-nacos">
    <img src="https://img.shields.io/badge/Docker-GHCR-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker Image" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square" alt="License" />
  </a>
  <a href="./CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome" />
  </a>
</p>

---

## 📖 项目简介

`mcp-server-nacos` 专为大语言模型（LLM）与智能体（AI Agent）设计，通过开放协议 **Model Context Protocol (MCP)** 将 **Nacos 3.0** 的服务发现、动态配置管理、命名空间隔离及健康探针能力全面工具化与资源化。

借助本服务，Claude Desktop、Cursor、Antigravity 以及私有化部署的多智能体平台能够直接化身为**微服务智能运维管家**，自主完成配置排查、服务拓扑分析、实例动态上下线与灰度流量治理。

---

## ✨ 核心特性

- 🎯 **Nacos 3.0 深度适配**：对齐 Nacos 3.0 Server (8848) 与 Console (8080) 解耦架构，无缝应对公网非对称 NAT 端口映射（如 58848/57206）；
- 🛠️ **全功能 CRUD 原子工具集 (16 Tools)**：覆盖配置发布/回滚/检索、命名空间管理、微服务健康度分析、实例权重与上下线控制；
- 🛡️ **大模型安全防御守卫**：客户端静默归一化命名空间入参、配置发布前置 JSON/YAML 语法强校验、长文本安全截断与按行切片读取；
- 📦 **配置资源化挂载 (MCP Resources)**：支持 `nacos://config/{tenant}/{group}/{dataId}` 资源协议，让 Agent 像读取本地文件一样直接检索动态配置；
- 💡 **开箱即用运维模版 (MCP Prompts)**：内置微服务健康全景体检（`nacos_service_inspection`）与配置版本漂移比对（`nacos_config_drift_check`）；
- 🔒 **自愈式会话认证 (Self-Healing Auth)**：针对开启鉴权的 Nacos 实例提供 Token 提前静默续期与 401 拦截重试机制，长会话零中断；
- 🐳 **独立容器化与 SSE 预留**：内置 `docker-compose.yml`，暴露 3000 端口，开箱支持远程 Agent / Dify 等多智能体平台接入；
- ⚡ **超轻量极速启动**：基于 Node.js 运行时与 `tsup` 预编译打包，本地 Stdio 进程毫秒级冷启动，内存占用 < 50MB。

---

## 🌐 网络拓扑与端口寻址模型

针对现代云原生及 Docker 公网 NAT 场景，服务端支持灵活的双端点独立寻址：

```text
+-------------------------------------------------------------------------+
|                              网络拓扑映射模型                              |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ MCP 客户端 (Claude / Cursor / Dify) ]                                 |
|           | (Stdio / Docker / SSE)                                      |
|           v                                                             |
|  [ mcp-server-nacos (Port: 3000) ]                                      |
|           |                                                             |
|           +--- (HTTP OpenAPI 主通道) ---> 8848 [公网 NAT: 58848]         |
|           |                                路径: /nacos/                |
|           |                                                             |
|           +--- (Web Console 辅助通道) --> 8080 [公网 NAT: 57206]         |
|           |                                路径: /next/                 |
|           |                                                             |
|           x--- (客户端 gRPC 协议) --------> 9848 [公网 NAT: 59848]         |
|                (MCP 保持纯净 HTTP 通信，规避 NAT 端口偏移计算失效)              |
+-------------------------------------------------------------------------+
```

---

## 🛡️ 大模型安全防御守卫机制 (AI Safety Guardrails)

为防止大模型幻觉与不当参数引发生产事故，本项目在 MCP 客户端边界内置了三重刚性守卫：

1. **命名空间智能静默归一化 (Silent Normalization)**：
   - 识别大模型常混淆的 `undefined`、`"public"`、`"PUBLIC"` 输入，并在客户端层统一静默转换为底层协议所需的 `""`（空字符串）或配置环境变量的默认空间，确保接口请求 100% 成功。
2. **发布前置语法安全守卫 (Syntax Guardrails)**：
   - 在向 Nacos 提交配置变更前，若声明了 `type: "json"` 或 `type: "yaml"`，客户端自动在本地执行解析校验。
   - 一旦发现括号缺失、缩进错误等格式缺陷，立即就地阻断请求，并向大模型返回具体的行号与修复指引，杜绝脏配置污染存储导致下游服务崩溃。
3. **超长配置按行切片防护 (Token Bloat Protection)**：
   - 当微服务配置超过 30,000 字符（约 800 行）时，自动返回前 200 行内容摘要与全文字符统计，并指导大模型传入 `startLine` 与 `endLine` 进行按需切片阅读，保护模型上下文窗口容量。

---

## ⚙️ 环境变量与参数配置

所有配置项均采用 `MCP_NACOS_` 专业命名空间，支持命令行参数（CLI Flags）与环境变量双重注入：

| 环境变量名 | CLI 选项 | 必填 | 默认值 | 说明与 NAT 场景示例 |
| :--- | :--- | :--- | :--- | :--- |
| `MCP_NACOS_SERVER_URL` | `--server-url` | 是* | `http://127.0.0.1:8848/nacos` | Nacos 核心 OpenAPI 地址（NAT: `http://<IP>:58848/nacos`） |
| `MCP_NACOS_CONSOLE_URL` | `--console-url` | 否 | `http://127.0.0.1:8080` | Web 控制台地址（NAT: `http://<IP>:57206`） |
| `MCP_NACOS_SERVER_ADDR` | `--server-addr` | 否 | `127.0.0.1:8848` | 简写 Host:Port 格式（供本地极简推断） |
| `MCP_NACOS_USERNAME` | `--username` | 否 | - | Nacos 访问用户名（开启鉴权时必填） |
| `MCP_NACOS_PASSWORD` | `--password` | 否 | - | Nacos 访问密码（开启鉴权时必填） |
| `MCP_NACOS_NAMESPACE_ID`| `--namespace` | 否 | `public` (空) | 默认命名空间 Tenant ID |
| `MCP_NACOS_REQUEST_TIMEOUT` | `--timeout` | 否 | `15000` | HTTP 请求超时时间（毫秒） |
| `MCP_PORT` | `--port` | 否 | `3000` | 容器或网络模式下的监听端口 |
| `MCP_TRANSPORT` | `--transport` | 否 | `stdio` | 传输层模式：`stdio` (默认桌面端) 或 `sse` (远程网络模式) |

---

## 🚀 快速接入指南

### 1. Claude Desktop 配置 (Stdio 模式)

在 Claude Desktop 配置文件（Windows: `%APPDATA%\Claude\claude_desktop_config.json`，macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`）中添加：

#### 方式 A：通过 npx 免安装运行（推荐）

```json
{
  "mcpServers": {
    "nacos": {
      "command": "npx",
      "args": ["-y", "@atengk/mcp-server-nacos"],
      "env": {
        "MCP_NACOS_SERVER_URL": "http://127.0.0.1:8848/nacos",
        "MCP_NACOS_USERNAME": "nacos",
        "MCP_NACOS_PASSWORD": "nacos"
      }
    }
  }
}
```

#### 方式 B：通过 Docker CLI 运行

```json
{
  "mcpServers": {
    "nacos": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "MCP_NACOS_SERVER_URL=http://host.docker.internal:8848/nacos",
        "-e", "MCP_NACOS_USERNAME=nacos",
        "-e", "MCP_NACOS_PASSWORD=nacos",
        "ghcr.io/atengk/mcp-server-nacos:latest"
      ]
    }
  }
}
```

### 2. Cursor 配置 (Stdio 模式)

在项目根目录 `.cursor/mcp.json` 或 Cursor 全局设置中配置：

```json
{
  "mcpServers": {
    "nacos": {
      "command": "npx",
      "args": ["-y", "@atengk/mcp-server-nacos"],
      "env": {
        "MCP_NACOS_SERVER_URL": "http://127.0.0.1:8848/nacos",
        "MCP_NACOS_USERNAME": "nacos",
        "MCP_NACOS_PASSWORD": "nacos"
      }
    }
  }
}
```

---

### 3. VSCode (Cline / Roo Code) 配置 (Stdio 模式)

在 VSCode 插件（如 Cline / Roo Code）的 MCP 设置中添加：

```json
{
  "mcpServers": {
    "nacos": {
      "command": "npx",
      "args": ["-y", "@atengk/mcp-server-nacos"],
      "env": {
        "MCP_NACOS_SERVER_URL": "http://127.0.0.1:8848/nacos",
        "MCP_NACOS_USERNAME": "nacos",
        "MCP_NACOS_PASSWORD": "nacos"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

---

### 4. Docker Compose 独立服务部署 (SSE / 远程网络模式)

仓库内置了 [docker-compose.yml](./docker-compose.yml)，用于将 MCP Server 部署为独立容器服务并暴露 3000 端口：

```bash
# 1. 复制环境变量模版并按需配置
cp .env.example .env

# 2. 启动服务 (后台运行)
docker compose up -d

# 3. 查看运行日志
docker compose logs -f
```

---

### 5. Dify / FastGPT 等多智能体平台接入 (SSE 模式)

当通过 Docker Compose 或后台网络模式运行后，在各类大模型智能体平台（如 Dify、FastGPT）的 MCP 工具集成页面中添加自定义 MCP 服务端：

- **集成类型**：`Server-Sent Events (SSE)`
- **服务端端点 URL**：`http://<宿主机IP或域名>:3000/sse`
- **消息回调 URL**：系统自动协商绑定 `http://<宿主机IP或域名>:3000/message`

---

## 🧰 MCP 协议契约详述

### 1. MCP Tools (16 个原子工具集)

#### 命名空间域 (Namespace)
- `nacos_list_namespaces`: 查询所有命名空间列表及元数据。
- `nacos_create_namespace`: 创建新的命名空间（`namespaceId`, `namespaceName`, `namespaceDesc`）。
- `nacos_delete_namespace`: 删除指定命名空间。

#### 配置管理域 (Config)
- `nacos_get_config`: 获取指定配置项内容（支持大文本自动截断与 `startLine`/`endLine` 切片）。
- `nacos_publish_config`: 创建或更新配置（内置客户端 JSON/YAML 语法强守卫）。
- `nacos_delete_config`: 删除指定配置。
- `nacos_list_configs`: 分页模糊搜索配置列表。
- `nacos_get_config_history`: 查询指定配置的历史修订版本列表（用于审查和回滚）。
- `nacos_rollback_config`: **[专用回滚]** 依据 `historyId` 原子化回滚至指定历史版本，杜绝长文本搬运截断。

#### 服务发现与实例治理域 (Naming/Discovery)
- `nacos_list_services`: 分页查询微服务列表。
- `nacos_get_service`: 获取微服务元数据与保护阈值。
- `nacos_list_instances`: 查询服务下的注册实例（支持过滤健康状态）。
- `nacos_register_instance`: 手动向服务注册实例（默认持久化实例，支持显式声明临时实例）。
- `nacos_deregister_instance`: 注销指定服务实例。
- `nacos_update_instance`: 动态修改实例运行状态（上下线开关、权重比率调节与元数据打标）。

#### 集群运维域 (Ops)
- `nacos_get_server_status`: 探测 Nacos 集群节点当前运行状态与健康度。

### 2. MCP Resources (动态配置挂载)
- **URI 范式**：`nacos://config/{namespaceId}/{group}/{dataId}`
- **功能**：大模型无需多轮触发函数调用，可直接将微服务配置挂载至上下文用于分析审查。

### 3. MCP Prompts (预置运维模版)
- **`nacos_service_inspection`**：服务全景体检，自动扫描无实例空服务、健康异常与被隔离实例。
- **`nacos_config_drift_check`**：配置版本漂移比对，自动生成当前配置与上一历史版本的 Unified Git Diff。

---

## 🗺️ 架构与工程决策导航 (Architecture & Decisions)

本项目严格遵循高内聚领域驱动与工程架构决策规范：

- 📚 **统一业务语言词典**：[CONTEXT.md](./CONTEXT.md)（严格界定命名空间、配置项、实例权重、测试接缝等标准定义）
- 📐 **架构决策记录 (ADR)**：
  - [ADR-0001: 采用 HTTP OpenAPI 全面替代客户端 gRPC 协议](./docs/adr/0001-http-openapi-over-grpc.md)
  - [ADR-0002: 实例注册默认采用持久化模式 (Persistent Instance)](./docs/adr/0002-persistent-instance-as-default.md)
  - [ADR-0003: 采用 MCP Tool 分发层作为最高测试接缝 (Highest Testing Seam)](./docs/adr/0003-highest-testing-seam-at-mcp-tool-dispatch.md)
  - [ADR-0004: 配置回滚基于 historyId 纯元数据原子触发](./docs/adr/0004-atomic-rollback-via-history-id.md)
  - [ADR-0005: 采用 Stdio / SSE 双模传输架构兼顾桌面单机与容器远程](./docs/adr/0005-dual-transport-stdio-and-sse.md)
- 📋 **GitHub 任务看板与规格书**：[GitHub Issues 看板](https://github.com/atengk/mcp-server-nacos/issues)
  - [Issue #1 (Spec 规格说明书)](https://github.com/atengk/mcp-server-nacos/issues/1)
  - [Issue #2 (Ticket 1: 核心底座与命名空间切片)](https://github.com/atengk/mcp-server-nacos/issues/2)
  - [Issue #3 (Ticket 2: 配置核心与语法守卫切片)](https://github.com/atengk/mcp-server-nacos/issues/3)
  - [Issue #4 (Ticket 3: 配置历史与原子回滚切片)](https://github.com/atengk/mcp-server-nacos/issues/4)
  - [Issue #5 (Ticket 4: 服务发现与实例治理切片)](https://github.com/atengk/mcp-server-nacos/issues/5)
  - [Issue #6 (Ticket 5: MCP Resources 与 Prompts 切片)](https://github.com/atengk/mcp-server-nacos/issues/6)
  - [Issue #7 (Ticket 6: 双模传输与 Compose 全景联调)](https://github.com/atengk/mcp-server-nacos/issues/7)

---

## 🛡️ 安全校验和 (SHA-256 Checksums) 验证指引

从 [GitHub Releases](https://github.com/atengk/mcp-server-nacos/releases) 页面下载分发产物与 `checksums.txt` 清单后，可一键验证文件防篡改完整性：

- **Linux**：
  ```bash
  sha256sum -c checksums.txt --ignore-missing
  ```
- **macOS**：
  ```bash
  shasum -a 256 -c checksums.txt
  ```
- **Windows (PowerShell)**：
  ```powershell
  Get-FileHash .\mcp-server-nacos-*-bundle.tar.gz -Algorithm SHA256
  ```

---

## 🛠️ 本地开发与构建

```bash
# 1. 克隆代码仓库
git clone https://github.com/atengk/mcp-server-nacos.git
cd mcp-server-nacos

# 2. 安装项目依赖
pnpm install

# 3. 编译打包
pnpm run build

# 4. 本地启动运行
node dist/index.js
```

---

## 📄 开源许可证

本项目基于 [Apache 2.0 开源许可证](./LICENSE) 分发与使用。
