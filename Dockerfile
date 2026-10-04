# ==============================================================================
# 第一阶段：构建阶段 (Build Stage)
# ==============================================================================
FROM node:22-slim AS builder

WORKDIR /app

# 安装 pnpm 包管理器
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制依赖配置并预缓存
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# 复制源码并执行构建
COPY tsconfig.json tsup.config.ts ./
COPY src/ ./src/
RUN pnpm run build

# 仅保留生产依赖
RUN pnpm prune --prod

# ==============================================================================
# 第二阶段：运行阶段 (Production Runner)
# ==============================================================================
FROM node:22-slim AS runner

WORKDIR /app

# 设置安全非 root 用户运行
USER node

# 复制编译产物与生产依赖
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

# 设置环境变量默认值
ENV NODE_ENV=production

# 声明服务监听端口 (用于远程 SSE 模式)
EXPOSE 3000

# 容器启动入口 (自适应支持 Stdio 交互模式与独立 SSE 网络模式)
ENTRYPOINT ["node", "dist/index.js"]
