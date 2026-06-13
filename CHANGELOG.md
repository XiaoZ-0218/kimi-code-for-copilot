# 更新日志

所有值得关注的变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-06-13

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
