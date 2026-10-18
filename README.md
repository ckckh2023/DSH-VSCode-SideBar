# DSH Web UI Sidebar

在 VSCode 侧边栏中运行 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）的 Web UI。

扩展通过 `dsh web --no-open` 启动 dsh 进程，从输出中解析带 token 的访问链接，并在侧边栏 WebView 中打开 Web UI。

## 前置要求

- VSCode ≥ 1.85
- 已安装 dsh 并在 PATH 中（或通过 `dsh.executablePath` 指定路径）：

```bash
npm install -g @deepseek-harness/cli
```

## 配置

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `dsh.executablePath` | `dsh` | dsh 可执行文件路径，Windows 系统会自动补全 `.cmd` |
| `dsh.autoStart` | `false` | 首次打开侧边栏视图时是否自动启动 |
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