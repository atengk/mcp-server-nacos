# 任务跟踪器规范：GitHub Issues

本代码库的所有缺陷（Issues）、功能需求（Feature Requests）与任务规范统一托管在 GitHub Issues。所有操作均通过系统 `gh` CLI 执行。

## 常用操作约定

- **创建 Issue**：`gh issue create --title "..." --body "..."`（长正文推荐通过临时文件或标准化模板提交）；
- **查看 Issue 详情与评论**：`gh issue view <编号> --comments`；
- **列出开放任务**：`gh issue list --state open --json number,title,body,labels,comments`；
- **添加评论**：`gh issue comment <编号> --body "..."`；
- **打标签 / 移除标签**：`gh issue edit <编号> --add-label "..."` 或 `--remove-label "..."`；
- **关闭 Issue**：`gh issue close <编号> --comment "..."`。

## Pull Request 分诊准则

- **是否将外部 PR 视作需求输入队列**：否（默认保持为关闭状态）。

## 技能协同指引

- **当技能指令要求“发布到跟踪器 (publish to the issue tracker)”时**：调用 `gh issue create` 新建 GitHub Issue；
- **当技能指令要求“检索相关任务卡 (fetch the relevant ticket)”时**：调用 `gh issue view <编号> --comments` 调阅上下文。
