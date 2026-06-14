# 更新日志

所有值得关注的变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 🛡️ 安全

- 用量看板默认仅监听 `127.0.0.1`，不再向全网暴露
- 新增 `kimi-code-copilot.dashboard.allowLan` 设置，开启局域网访问前需要用户确认
- 新增 `kimi-code-copilot.dashboard.accessToken` 设置，可为看板设置访问 Token
- 看板响应增加 CSP、`X-Frame-Options`、`X-Content-Type-Options` 等安全头
- 对看板和状态栏 Tooltip 中所有 API 返回的数据进行 HTML/Markdown 转义，防止 XSS 和命令注入
- 状态栏 Tooltip 的 Markdown 不再全局信任，仅允许已知的刷新命令
- `baseUrl` 强制要求 HTTPS 协议，防止 API Key 被明文发送
- 所有外部请求增加超时控制

### 🔧 改进

- 重写 SSE 流处理，移除 `async` Promise executor，正确处理取消操作
- 修复 `max_tokens` 在未配置时仍发送默认值的问题
- 修复看板“已用时间”显示语义
- 优化 deactivate 生命周期，确保资源正确释放

### ✨ 新增

- 安装/更新后显示一次性欢迎通知
- 新增 Walkthrough（快速开始指南）：获取 API Key、选择模型、追踪用量
- 新增 `Kimi Code: Open Welcome` 命令

## [1.0.0] - 2026-06-14

### ✨ 新增

- 将 Kimi Code（K2.7 Code）接入 GitHub Copilot Chat 作为 BYOK 语言模型提供商
- 注册 `kimi-code` vendor，提供两个模型变体：
  - `kimi-for-coding` — 快速模式，无思维链
  - `kimi-for-coding::thinking` — 思维链模式，深度推理
- 安全 API Key 管理：存储于 VS Code SecretStorage，设置时自动验证
- 状态栏实时用量显示：会话 Token 消耗 + 平台剩余额度
- 用量看板（Dashboard）：一键启动本地 HTTP 服务器，手机浏览器可访问
  - 响应式 HTML 仪表盘，支持深色/浅色主题
  - 实时显示会话统计、平台余额、使用进度
  - 每 5 秒自动刷新
- 完整支持 Copilot Chat 工具调用（tool calling）协议
- 管理菜单（Manage Provider）：一站式设置 Key、刷新用量、启停看板

### 🔧 配置

- `kimi-code-copilot.baseUrl` — API 地址（默认 `https://api.kimi.com/coding/v1`）
- `kimi-code-copilot.modelId` — 模型 ID（默认 `kimi-for-coding`）
- `kimi-code-copilot.maxTokens` — 最大输出 Token（默认 `0`）
- `kimi-code-copilot.debug` — 调试日志开关

### 📋 命令

- `Kimi Code: Manage Provider` — 管理菜单
- `Kimi Code: Set API Key` — 设置 API Key
- `Kimi Code: Clear API Key` — 清除 API Key
- `Kimi Code: Refresh Usage Info` — 刷新用量
- `Kimi Code: Clear Session Counter` — 清零会话计数器
- `Kimi Code: Start Usage Dashboard` — 启动用量看板
- `Kimi Code: Stop Usage Dashboard` — 停止用量看板
- `Kimi Code: Open Console` — 打开控制台
- `Kimi Code: Show Logs` — 显示日志
