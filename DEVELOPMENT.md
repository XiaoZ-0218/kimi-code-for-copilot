# 开发指南

## 环境要求

- Node.js ≥ 24
- VS Code ≥ 1.116.0
- npm

## 项目初始化

```bash
git clone https://github.com/xiaoz/kimi-code-for-copilot.git
cd kimi-code-for-copilot
npm install
```

## 开发流程

### 编译

```bash
npm run compile    # 单次编译
npm run watch      # 监听模式
```

### 调试

1. 在 VS Code 中打开项目根目录
2. 按 **F5**（或 `运行 > 启动调试`）
3. 会打开一个新的 VS Code 窗口（Extension Development Host）
4. 在新窗口中测试扩展功能

### 日志

执行 **Kimi Code: Show Logs** 查看扩展日志。日志输出到 "Kimi Code for Copilot" 输出通道。

开启调试日志：设置 `kimi-code-copilot.debug` 为 `true`。

## 架构说明

本扩展实现了 VS Code 的 `LanguageModelChatProvider` 接口，将 Kimi Code API 注册为 Copilot Chat 的可用模型。

### 核心流程

```
用户输入 → Copilot Chat
              │
              ▼
     KimiCodeChatProvider.provideLanguageModelChatResponse()
              │
              ▼
     prepareChatRequest() → 转换为 OpenAI 格式
              │
              ▼
     streamChatCompletion() → SSE 流式请求
              │
              ▼
     progress.report() → 逐块返回给 Copilot Chat
```

### 关键接口

**LanguageModelChatProvider** (VS Code API):
- `provideLanguageModelChatInformation()` — 返回可用模型列表
- `provideLanguageModelChatResponse()` — 处理聊天请求，通过 `progress` 回调返回流式响应
- `provideTokenCount()` — 估算 Token 数量

### API 适配

Kimi Code API 兼容 OpenAI Chat Completions 协议：

- Base URL: `https://api.kimi.com/coding/v1`
- 认证: `Authorization: Bearer <API_KEY>`
- 流式: SSE（Server-Sent Events）
- Thinking: `"thinking": {"type": "enabled"}`

## 添加新功能

### 添加新的模型变体

编辑 `src/consts.ts` 中的 `MODELS` 数组：

```typescript
{
  id: 'your-model-id',
  name: 'Your Model Name',
  family: 'your-family',
  version: 'default',
  maxInputTokens: 196608,
  maxOutputTokens: 65536,
  thinking: false,
  // ...
}
```

### 添加新命令

1. 在 `package.json` 的 `contributes.commands` 中注册
2. 在 `src/extension.ts` 的 `activate()` 中实现

## 打包与发布

```bash
# 更新版本号
# 编辑 package.json → version

# 打包
npm run package

# 生成的 VSIX 在 dist/ 目录下
```

## 常见调试技巧

1. **模型不显示**：检查是否设置了 API Key，查看日志
2. **请求失败**：检查 API Key 是否有效，Base URL 是否正确
3. **用量看板无法启动**：检查端口是否被占用
