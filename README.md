# DSH Web UI Sidebar

在 VSCode 侧边栏中运行 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）的 Web UI。

扩展通过 `dsh web --no-open` 启动 dsh 进程，从输出中解析带 token 的访问链接，并在侧边栏 WebView 中打开 Web UI。

## 功能

- **启动 / 停止**：侧边栏标题栏 ▶ / ■ 按钮，等价于执行 `dsh web --no-open` 与 Ctrl+C
- **WebView 挂载**：解析 token URL 后整页导航加载 Web UI（第一方上下文，会话 cookie 正常工作）
- **浏览器打开**：🌐 按钮用系统浏览器打开当前链接
- **状态机**：stopped → starting → running → stopping，进程意外退出时自动回到欢迎页并提示
- **日志**：dsh 输出（token 自动脱敏）写入 "DSH" Output 频道
- **退出清理**：VSCode 关闭时自动结束 dsh 进程，防孤儿进程

## 前置要求

- VSCode ≥ 1.85
- 已安装 dsh 并在 PATH 中（或通过 `dsh.executablePath` 指定路径）：

```bash
npm install -g @deepseek-harness/cli
```

## 使用

1. 点击活动栏 DSH 图标打开侧边栏
2. 点击 ▶（或界面中的"启动 DSH"按钮）
3. 等待链接输出，Web UI 将自动加载到侧边栏

## 配置

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `dsh.executablePath` | `dsh` | dsh 可执行文件路径，Windows 下自动补 `.cmd` |
| `dsh.autoStart` | `false` | 首次打开侧边栏视图时自动启动 |
| `dsh.startupTimeoutMs` | `30000` | 等待 dsh 输出访问链接的超时（毫秒） |

## 开发

```bash
npm install        # 安装依赖
npm run build      # esbuild 构建 out/extension.js
npm run watch      # 监听构建
npm run smoke      # 冒烟测试：真实启动 dsh web → 解析 URL → 停止
npm run package    # 打包 .vsix
```

调试：VSCode 中按 F5 打开扩展开发宿主。

## 安装 vsix

```bash
code --install-extension dsh-sidebar-0.1.0.vsix
```

## 实现说明

- **进程管理**：`child_process.spawn` 启动 dsh（Windows 下经 `cmd.exe /c` 包装 `.cmd`），逐行解析 stdout 提取带 token 的 URL；停止时优先发送 Ctrl+Break/SIGINT，失败则 `taskkill /T /F` 结束进程树兜底
- **为何不用 iframe**：dsh 采用"启动 token 换会话 cookie"认证，跨站 iframe 中 `SameSite=Lax` cookie 不会随请求发送，会得到 "authentication required"；故采用顶层导航使 webview 成为第一方文档
- **安全**：webview 启用严格 CSP；token 不写入日志（脱敏为 `token=***`）

## License

[MIT](./LICENSE)