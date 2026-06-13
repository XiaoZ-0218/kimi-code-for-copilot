# 贡献指南

感谢你考虑为 Kimi Code for Copilot 做出贡献！

## 🐛 报告问题

在 [Issues](https://github.com/xiaoz/kimi-code-for-copilot/issues) 中提交 Bug 或功能请求。

提交 Bug 时请包含：
- VS Code 版本
- 扩展版本
- 复现步骤
- 预期行为 vs 实际行为
- 扩展日志（`Kimi Code: Show Logs` 输出）

## 🔧 开发

```bash
# 克隆仓库
git clone https://github.com/xiaoz/kimi-code-for-copilot.git
cd kimi-code-for-copilot

# 安装依赖
npm install

# 编译
npm run compile

# 监听
npm run watch
```

按 **F5** 启动 Extension Development Host 进行调试。

## 📁 项目结构

```
src/
├── extension.ts          # 扩展入口
├── auth.ts               # API Key 管理
├── config.ts             # 配置读取
├── consts.ts             # 常量
├── logger.ts             # 日志
├── types.ts              # 类型定义
├── dashboard/
│   └── server.ts         # 用量看板 Web 服务器
└── provider/
    ├── index.ts          # Chat Provider
    ├── balance.ts        # 用量追踪
    ├── models.ts         # 模型信息
    ├── request.ts        # 请求构建
    └── stream.ts         # 流式响应
```

## 📝 代码规范

- 使用 TypeScript 严格模式
- 提交信息使用中文，格式：`类型: 简短描述`
  - `feat:` 新功能
  - `fix:` 修复
  - `docs:` 文档
  - `refactor:` 重构
  - `chore:` 杂项

## 📦 发布

```bash
# 1. 更新 CHANGELOG.md 和 package.json 版本号
# 2. 提交变更
git add -A && git commit -m "chore: 发布 vX.Y.Z"

# 3. 打包
npm run package

# 4. 发布到 VS Code Marketplace（需要 publisher 权限）
npx @vscode/vsce publish
```

## 📄 许可证

MIT — 详见 [LICENSE](./LICENSE)
