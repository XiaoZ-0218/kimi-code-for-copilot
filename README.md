# Kimi Code for Copilot

将 **Kimi Code（K2.7）** 接入 **GitHub Copilot Chat**，在状态栏实时查看 CodingPlan 用量。

## 功能

- 🔌 **BYOK 接入** — 使用自己的 Kimi Code API Key，在 Copilot Chat 模型选择器中直接使用
- 📊 **用量追踪** — 状态栏实时显示会话 Token 消耗和 Kimi Code 剩余额度
- 🌐 **用量看板** — 一键启动本地 Web 看板，手机浏览器可访问，精美 UI 实时展示用量
- 🧠 **思考模式** — 支持 K2.7 Code 的 extended thinking 能力
- 🔧 **一键管理** — 命令面板快速设置 API Key、查看用量、打开控制台

## 快速开始

### 1. 获取 API Key

访问 [Kimi Code 控制台](https://www.kimi.com/code/console) 创建 API Key（需要 Kimi Code Plan 订阅）。

### 2. 设置 API Key

- 按 `Cmd+Shift+P` 打开命令面板
- 搜索并执行 **Kimi Code: Set API Key**
- 粘贴你的 API Key

### 3. 选择模型

在 Copilot Chat 的模型选择器中，选择 **Kimi Code** 或 **Kimi Code (thinking)**。

### 4. 查看用量

状态栏右侧会显示当前会话的 Token 消耗和 Kimi Code 剩余额度。点击状态栏或执行 **Kimi Code: Manage Provider** 可进行更多操作。

### 5. 用量看板（手机可访问）

执行 **Kimi Code: Start Usage Dashboard** 启动本地 Web 服务器，终端会显示局域网地址。用手机浏览器打开即可看到精美的实时用量看板。

## 配置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `kimi-code-copilot.baseUrl` | `https://api.kimi.com/coding/v1` | Kimi Code API 地址 |
| `kimi-code-copilot.modelId` | `kimi-for-coding` | 模型 ID |
| `kimi-code-copilot.maxTokens` | `0`（模型默认） | 单次请求最大输出 Token |
| `kimi-code-copilot.debug` | `false` | 调试日志 |

## 模型

| 模型 | 说明 |
|------|------|
| **Kimi Code** | K2.7 Code · 快速模式 · 256K 上下文 |
| **Kimi Code (thinking)** | K2.7 Code · 深度思考 · 256K 上下文 |

## 要求

- VS Code ≥ 1.116.0
- GitHub Copilot Chat 扩展
- Kimi Code Plan 订阅

## 许可证

MIT
