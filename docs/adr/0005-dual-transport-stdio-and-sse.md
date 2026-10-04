# 0005: 采用 Stdio / SSE 双模传输架构兼顾桌面单机与容器远程

MCP 协议客户端涵盖单机桌面环境（如 Claude Desktop、Cursor，偏好轻量 Stdio 无端口启动）与远程多智能体平台（如 Docker 独立部署、Dify、FastGPT，需要持久 HTTP/SSE 网络服务）。为避免维护专有 WebSocket 协议栈的额外握手与心跳复杂度，本项目决定采用 MCP 官方标准的双模自适应传输：本地 Stdio 进程毫秒级冷启动，网络容器则通过 Express 暴露标准 SSE (`/sse` & `/message`) 端点，实现开箱即用的多场景全域兼容。
