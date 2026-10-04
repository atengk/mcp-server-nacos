# 贡献指南 (Contributing Guide)

感谢你关注并愿意为本项目贡献力量！为了保持高效协作与高质量的代码维护，请在提交代码前阅读以下规范。

---

## 1. 协作与分支模型

本项目遵循标准的 **GitHub Flow** 工作流：

1. **Fork 本仓库** 到你个人的 GitHub 账号；
2. **基于 `main` 分支拉取新的特性分支**：
   ```bash
   git checkout -b feat/your-feature-name
   # 或者缺陷修复分支
   git checkout -b fix/issue-description
   ```
3. 在本地完成修改，确保自测通过并补充相应测试用例；
4. 提交更改并推送到你的远程分支：
   ```bash
   git push origin feat/your-feature-name
   ```
5. 在 GitHub 上向本仓库的 `main` 分支发起 **Pull Request**。

---

## 2. Commit 提交信息规范

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范，统一采用以下格式：

```text
<type>(<scope>): <subject>
```

### 常用类型说明

| 类型 | 说明 | 示例 |
| :--- | :--- | :--- |
| `feat` | 新增功能或特性 | `feat(auth): 支持 OAuth2 登录授权` |
| `fix` | 缺陷与 Bug 修复 | `fix(parser): 修复空字符串解析导致空指针的问题` |
| `docs` | 仅文档更新或修改 | `docs: 完善快速开始与环境配置文档` |
| `style` | 代码格式调整（空格、分号等，不影响逻辑） | `style: 优化代码排版与换行` |
| `refactor` | 代码重构（既非新增特性也非修复缺陷） | `refactor(core): 抽取公共工具类` |
| `perf` | 性能优化 | `perf(cache): 引入本地二级缓存提升吞吐量` |
| `test` | 增加或重构单元测试与集成测试 | `test: 补充用户服务边界条件测试用例` |
| `build` | 构建系统、外部依赖或脚手架调整 | `build: 升级依赖版本至最新稳定版` |
| `ci` | CI/CD 流水线与 GitHub Actions 脚本修改 | `ci: 优化 release 自动化发版流程` |
| `chore` | 其他琐碎杂项（不改动源码与测试） | `chore: 更新 .gitignore 忽略规则` |
| `revert` | 恢复或回滚此前的某次历史提交 | `revert: feat(auth): 回退登录授权变动` |

---

## 3. Pull Request 流程

- **PR 标题规范**：PR 标题必须同样遵循 [Conventional Commits](#2-commit-提交信息规范) 格式（如 `feat: 新增能力` 或 `fix: 修复缺陷`），CI 会对其进行自动化合规校验；
- **模版填写**：发起 PR 时，请按模版完整填写变更背景、解决的问题以及关联的 Issue（如 `close #12`）；
- **CI 绿灯**：确保 CI 流水线测试全部处于通过状态；
- **审查与合并**：代码审查（Code Review）提出修改意见后，在原分支继续提交即可自动同步至 PR；合并后特性分支将被删除。

---

## 4. 版本发版机制与发布说明

本项目通过 GitHub Actions 实现了全自动化的 CI/CD 发版体系。正式发版标准流程如下：

### 1. 日常提交与日志归纳
平时向 `main` 分支提交代码或合并 PR 时，规范的提交记录（Conventional Commits）会被 `git-cliff` 自动追踪，并在发版时聚合生成清晰的标准更新日志。

### 2. 同步项目版本号（前置操作）
发版前需递增 `package.json` 中的版本号，请使用官方原生命令同步更新 `package.json` 与 `pnpm-lock.yaml`：

```bash
# 递增修订版本号 (补丁修复, 如 0.1.0 -> 0.1.1)
pnpm version patch

# 或递增次版本号 (新特性引入, 如 0.1.0 -> 0.2.0)
pnpm version minor

# 或递增主版本号 (破坏性更新, 如 0.1.0 -> 1.0.0)
pnpm version major
```

> 💡 *`pnpm version` 会自动在本地创建对应的 Git Tag 并提交。*

### 3. 推送代码与标签至远端（触发自动化发版）
当本地代码与版本准备就绪后，推送标签至 GitHub 即可触发发版流水线：

```bash
# 推送代码与标签至 GitHub (触发 .github/workflows/release.yml)
git push origin main --tags
```

### 4. 自动化流水线运行与分发产物
标签推送后，GitHub Actions 将会自动执行 [`.github/workflows/release.yml`](./.github/workflows/release.yml)：
1. **质量门禁硬防御**：自动执行静态类型检查（`pnpm run typecheck`）与全量集成测试（`pnpm test`），任何报错立即阻断发版；
2. **生成发布日志与 Release 挂载**：
   - 由 `git-cliff` 提取语义化提交记录自动生成发布说明；
   - 自动打包离线产物 `mcp-server-nacos-${version}-bundle.tar.gz` 与 npm 离线包 `atengk-mcp-server-nacos-${version}.tgz`；
   - 自动生成防篡改安全校验清单 `checksums.txt`（包含各包 SHA-256 哈希）并挂载至 GitHub Release 资产附件；
3. **分发至 npm 官方中心仓库**：自动通过 `NPM_TOKEN` 将包发布至 npm 官方仓库（`@atengk/mcp-server-nacos`）；
4. **多架构 Docker 镜像构建并推送 (GHCR)**：
   - 自动通过 Docker Buildx 构建兼容 `linux/amd64` 与 `linux/arm64` 的多架构容器镜像；
   - 自动推送到 GitHub Container Registry (`ghcr.io/atengk/mcp-server-nacos`)，非预发布版本自动标记为 `latest`。

### 中心仓库发布凭据 (Secrets) 参考

如需发布至 npm 与 Docker 仓库，需在仓库的 **Settings -> Secrets and variables -> Actions** 中配置对应凭据：

- **npm**: 在 GitHub Secrets 中配置 `NPM_TOKEN`（需具备 `@atengk` Scope 发布权限的 npm Access Token）；
- **Docker 镜像 (GHCR)**: 默认直接使用 GitHub Actions 系统内置的 `GITHUB_TOKEN`，具备 Packages 写入权限，**无需额外配置 Secret**。

