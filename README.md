# Lody iOS

独立的 iOS React Native 客户端。沿用 NewsLiquid 的 pnpm workspace + Expo Router + 本地 Swift Kit 架构，使用 Expo SDK 57 / RN 0.86。包含 Better Auth 登录、工作区选择、项目与 Session 元数据列表 POC。

## 开发

需要 Node.js 22.13+、pnpm 11.10.0、Xcode 和 CocoaPods。

```sh
pnpm install
pnpm ios          # 生成 iOS 工程、安装 Pods、编译并启动模拟器
pnpm start        # 已安装原生 App 后启动 Metro
pnpm check
pnpm test
pnpm bundle       # iOS Hermes bundle 验证
```

自定义 Swift 模块需要本地原生构建，不能用 Expo Go。`pnpm prebuild` 可单独生成 iOS 工程。真机签名在本地 Xcode 中选择自己的 Team；默认 bundle id 为 `app.innei.lody`，可在 app config 修改。

## 结构

```text
apps/mobile/
  src/app/                  Expo Router 原生 Stack 路由
  src/presentation/         definePage / present / PageRuntime
  src/features/             业务页面
  src/ui/                   共享 RN 组件
  modules/lody-kit/
    src/                    唯一的 TypeScript 原生 API 入口
    ios/LodyKitModule.swift  统一模块注册
    ios/Chrome/             Swift 原生 UI
```

所有自研原生能力均在 `LodyKit` 中按功能目录扩展。RN 无法满足体验要求的 UI 使用 Swift/UIKit 或 SwiftUI，并由同一 Kit 注册。`ios/` 是 Expo 生成物，不手工维护；无 Android 目标、脚本或实现。

运行环境页面实际读取 Swift 模块常量、加载公开 Streams 客户端，并通过 UIKit 关闭按钮向 RN 派发事件。手工验收：进入“查看运行环境”，确认显示 iOS 版本与 LodyKit，点击原生关闭按钮返回首页；深色模式重复一次。

## Cloud 接入边界

前序研究已验证官方 Cloud → Streams token → long-poll → 在线 Mac 的只读 RPC。底层 `@loro-dev/streams-client@0.7.0` 可在 RN 打包，因此直接依赖其公开 npm 包。运行环境页加载它来维持 Metro 兼容检查，不会发送网络请求。

不能直接导入 Lody RPC/shared 总入口：其依赖链会拉入 Node 文件系统和 CRDT/Zstd。RN 负责登录界面；LodyKit 提供短期 Streams 授权，离屏 WKWebView 内复用官方 Flock WASM 并持续读取增量，仅向 RN 返回项目和 Session 的必要字段。

登录使用官方 Better Auth Device Flow。目前服务端未注册 `lody-ios`，POC 使用已注册的 `lody-cli` 客户端，授权页面会显示该名称。点击登录，在系统授权页面登录并批准匹配的设备码；App 自动完成登录并将凭据存入 Swift Keychain。下次启动恢复登录，设置页可退出。正式发布前应由服务端注册独立客户端。

登录后选择工作区，点击项目通过 `present()` 打开 Session 列表。目录由离屏 WebView 持续读取增量，刷新会重建同步运行时；点击会话可读取消息正文并发送纯文本，由同一 WebView 同步机器回复。单个目录读取限制为 8 MiB / 100 页，超过上限会明确失败；达到本轮输入上限后需重新同步；更大目录需要完善压缩与持久化策略。

`pnpm ios`、`pnpm prebuild` 和 `pnpm bundle` 会先生成本地 WebView 资源；直接使用 Xcode 构建前先执行 `pnpm --filter @lody-ios/mobile native:assets`。原生资源包含 Flock 的许可证。

## Router、present 和 Native Kit

已迁入 NewsLiquid 的页面呈现层：NativeTabs + 每个 Tab 的原生 Stack，`definePage` 双入口、Promise 结果、嵌套 Sheet、关闭清理。设置页可直接操作四种呈现样式；运行环境页可测试参数、完成/取消、Swift 异步调用和原生事件。

完整用法与文件映射见 [架构与开发用法](docs/architecture.md)。

## 离屏数据运行时 POC

项目页现在使用 Swift 管理的离屏 WKWebView，WebView 内持有 Flock 副本和 Streams 增量游标。原生看门狗每 2 秒探测 JS；启动 20 秒、心跳 8 秒超时会重建。60 秒内最多自动重启 3 次，超出后需要手动重试。Debug 页面可注入 JS 死循环和模拟进程丢失。

进入后台主动释放 WebView，返回前台重新 bootstrap 并恢复目录订阅。本阶段支持消息正文与纯文本发送，没有磁盘副本、离线写入及工具/附件交互；断线或重建期间已有列表可能过期。详细验收见 [运行时 POC](docs/webview-runtime-poc.md)。

## 初版 UI MVP

UI 首要目标是符合 [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/)：原生导航、安全区、44 pt 触控区域和系统语义色；不用绿色强调色或带绿背景。MVP 按默认字号验收，不专门适配超大辅助字号。

参考 [expo-ai-chatbot-lite](https://github.com/expo-ai-chatbot/expo-ai-chatbot-lite) 的消息布局与输入体验，保留 LodyKit 登录、同步与消息发送链路。当前包括项目/会话搜索、消息气泡、Markdown 文本、折叠思考、键盘避让、浅深色主题和账户设置。调试入口位于「设置 → Debug」，仅开发构建显示。

设置页使用 LodyKit 内的 Swift `UICollectionViewListCell`，保留 UIKit 的分组、分隔线、选中态与动态行高。导航栏沿用原生 soft scroll edge。

项目的会话列表右上角「＋」可新建会话，选择电脑已有的助手配置并命名，创建后自动进入聊天。本地项目使用所属电脑的现有目录；GitHub 项目选择电脑与起始分支，由电脑创建工作区。模型与运行模式使用助手默认值。创建失败可以刷新配置；响应未知时不重试写入，以同步后的列表为准。

附件与图片展示、完整工具卡片和权限交互尚未实现。

本轮验证：`pnpm check`、8 项行为测试、Hermes bundle 与正常签名的 iOS 模拟器构建通过；模拟器确认项目搜索、真实消息 Markdown、键盘避让、浅深色、原生设置行到 Debug 的导航，以及 Debug 注入 JS 卡死后的看门狗恢复。构建过程中修复了原生 UICollectionView 误套 RN ScrollViewMarker 导致的启动崩溃。
