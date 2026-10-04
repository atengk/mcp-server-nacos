# 0001: 采用 HTTP OpenAPI 全面替代客户端 gRPC 协议

在公网 NAT、Docker 端口映射及多样化宿主网络环境下，Nacos 官方 gRPC 客户端写死的“HTTP 端口 + 1000”寻址偏移计算必然失效，且维持双向 gRPC 长连接会增加本地 Stdio 进程的复杂度与内存开销。因此，本项目决定 MCP Server 与 Nacos 3.0 的交互全面基于无状态的 HTTP OpenAPI（8848/8080），以获得最佳的跨网络容错性与极简的运行时开销。
