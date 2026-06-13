<img alt="Kimi Code for Copilot" src="resources/icon.png" width="128">

# Kimi Code for Copilot

将 **Kimi Code（K2.7 Code）** 接入 **GitHub Copilot Chat**——在状态栏、命令面板、手机上实时追踪 CodingPlan 用量。

[![VS Code](https://img.shields.io/badge/VS%20Code-≥1.116-6366f1?logo=visualstudiocode)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](./package.json)

---

## ✨ 功能亮点

| 功能 | 描述 |
|------|------|
| 🔌 **BYOK 无缝接入** | 配置 Kimi Code API Key 后，在 Copilot Chat 模型选择器中直接选用 |
| 📊 **实时用量看板** | 状态栏实时显示 Token 消耗 + 平台剩余额度，一目了然 |
| 🌐 **局域网用量看板** | 一键启动 Web 服务器，手机扫码即可查看精美仪表盘 |
| 🧠 **思维链模式** | 支持 K2.7 Code 的 extended thinking，深度推理复杂问题 |
| 🛠️ **工具调用** | 完整支持 Copilot 的工具调用（tool calling）协议 |
| 🔑 **安全存储** | API Key 存储于 VS Code SecretStorage，不上传、不泄露 |

---

## 🚀 快速开始

### 前置条件

- **VS Code** `≥ 1.116.0`
- **GitHub Copilot Chat** 扩展（预装在 VS Code 中）
- **Kimi Code Plan** 订阅（[查看套餐](https://www.kimi.com/code?track_id=25629d38-3867-4df5-b523-c8251221380a)）

### 安装

#### 方式一：从 VSIX 安装

```bash
# 下载最新 .vsix 文件后
code --install-extension kimi-code-for-copilot-0.1.0.vsix
```

#### 方式二：从源码构建

```bash
git clone https://github.com/xiaoz/kimi-code-for-copilot.git
cd kimi-code-for-copilot
npm install
npm run compile
# 按 F5 启动扩展开发窗口
```

### 配置 API Key

1. 访问 [Kimi Code 控制台](https://www.kimi.com/code/console) 创建 API Key
2. `Cmd+Shift+P` → **Kimi Code: Set API Key**
3. 粘贴 API Key，自动验证并保存

### 开始使用

1. 打开 Copilot Chat（`Cmd+Shift+I`）
2. 点击模型选择器，选择 **Kimi Code** 或 **Kimi Code (thinking)**
3. 开始对话！

---

## 📊 用量追踪

### 状态栏

状态栏右侧实时显示：

```
$(pulse) 12.5K tok $(credit-card) ¥49.00
```

- **左侧**：本次会话累计 Token 消耗
- **右侧**：Kimi Code 平台剩余额度
- **点击**：打开管理菜单

### 用量看板（手机可访问）

执行 **Kimi Code: Start Usage Dashboard**，终端输出局域网地址：

```
📡 用量看板已启动
   本地:    http://localhost:54321
   局域网:  http://192.168.1.100:54321
```

用手机浏览器打开局域网地址，即可看到实时刷新的精美仪表盘，包含：

- 本次会话请求次数、Token 明细
- 平台剩余额度及使用进度条
- 自动每 5 秒刷新

停止看板：**Kimi Code: Stop Usage Dashboard**

### 命令列表

| 命令 | 说明 |
|------|------|
| `Kimi Code: Manage Provider` | 打开管理菜单（设置 Key、刷新用量、看板等） |
| `Kimi Code: Set API Key` | 设置 API Key |
| `Kimi Code: Clear API Key` | 清除 API Key |
| `Kimi Code: Refresh Usage Info` | 手动刷新平台用量 |
| `Kimi Code: Clear Session Counter` | 清零本次会话计数器 |
| `Kimi Code: Start Usage Dashboard` | 启动用量看板 Web 服务器 |
| `Kimi Code: Stop Usage Dashboard` | 停止用量看板 |
| `Kimi Code: Open Console` | 打开 Kimi Code 控制台 |
| `Kimi Code: Show Logs` | 显示扩展日志 |

---

## ⚙️ 配置

在 VS Code 设置中搜索 `kimi-code-copilot`：

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `kimi-code-copilot.baseUrl` | `string` | `https://api.kimi.com/coding/v1` | Kimi Code API 地址（OpenAI 兼容） |
| `kimi-code-copilot.modelId` | `string` | `kimi-for-coding` | 模型 ID，Kimi 建议保持默认 |
| `kimi-code-copilot.maxTokens` | `number` | `0` | 单次最大输出 Token，`0` 表示模型默认 |
| `kimi-code-copilot.debug` | `boolean` | `false` | 开启调试日志（输出通道） |

---

## 🧠 模型

| 模型 ID | 说明 | 上下文 | 最大输出 |
|---------|------|--------|----------|
| `kimi-for-coding` | K2.7 Code · 快速模式 | 196K | 64K |
| `kimi-for-coding::thinking` | K2.7 Code · 思维链模式 | 196K | 64K |

> 模型 ID 固定为 `kimi-for-coding`，Kimi 后端会自动升级到最新模型，无需修改配置。

---

## 🏗️ 架构

```
┌──────────────────────────────────────┐
│         GitHub Copilot Chat          │
├──────────────────────────────────────┤
│  LanguageModelChatProvider (BYOK)    │
│  ┌────────────────────────────────┐  │
│  │   KimiCodeChatProvider         │  │
│  │   ├─ provideLanguageModels()   │  │
│  │   ├─ provideChatResponse()     │  │
│  │   └─ provideTokenCount()       │  │
│  └──────────────┬─────────────────┘  │
│                 │ HTTP SSE            │
│  ┌──────────────▼─────────────────┐  │
│  │   Kimi Code API                │  │
│  │   api.kimi.com/coding/v1       │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │   BalanceTracker               │  │
│  │   ├─ 状态栏 Token 计数          │  │
│  │   ├─ 平台余额查询               │  │
│  │   └─ DashboardServer HTTP 看板  │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## 🔧 开发

```bash
# 安装依赖
npm install

# 编译（自动清理 + tsc）
npm run compile

# 监听模式
npm run watch

# 打包 VSIX
npm run package

# 代码检查
npm run lint
```

调试：按 **F5** 启动 Extension Development Host。

---

## ❓ 常见问题

**Q: 为什么模型选择器里看不到 Kimi Code？**

A: 确认已设置 API Key（`Kimi Code: Set API Key`）。设置后模型列表会自动刷新。

**Q: 用量看板手机打不开？**

A: 确保手机和电脑在同一局域网。如果仍无法访问，检查电脑防火墙是否阻止了端口。

**Q: API Key 存在哪里？**

A: 存储在 VS Code 的 [SecretStorage](https://code.visualstudio.com/api/references/vscode-api#SecretStorage) 中，与系统密钥链集成。

**Q: 支持图片输入吗？**

A: 当前版本暂不支持 Vision。Kimi Code 模型本身支持图片理解，后续版本会加入。

---

## 📄 许可证

[MIT](./LICENSE) © 2026 xiaoz

---

**相关链接**：[Kimi Code 官网](https://www.kimi.com/code) · [Kimi Code 文档](https://www.kimi.com/code/docs/) · [控制台](https://www.kimi.com/code/console) · [GitHub](https://github.com/xiaoz/kimi-code-for-copilot)
