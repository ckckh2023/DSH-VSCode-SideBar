# DSH Web UI Sidebar

在 VSCode 侧边栏中运行 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）的 Web UI。

> [!CAUTION]
> 此插件目前仍使用 Web UI 而非自制 VSCode 原生 UI！如有想法可以提交 [Issue](https://github.com/ckckh2023/DSH-VSCode-SideBar/issues)。

> [!TIP]
> 由于已经有开发者制作了原生 VSCode UI 的 DSH 侧边栏插件，为了不重复造轮子，故停止开发，可以前往 [dsh-sidebar](https://github.com/Lixxx1/dsh-vscode) 查看。

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
npm run package    # 打包 .vsix
```

调试：VSCode 中按 F5 打开扩展开发宿主。
