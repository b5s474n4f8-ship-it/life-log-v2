# 自动同步一次性设置

## 以后会怎样

完成本页的一次性设置后：

1. iPhone 每次保存先落到本机。
2. 联网时自动把完整当前状态同步到私人 Cloudflare D1。
3. 离线时照常记录；恢复联网、回到前台或重开 App 后自动补传。
4. Codex 处理 Life Log 任务前，自动拉取最新云端副本。
5. 不再需要手工导出、上传或发送 JSON。

手动导出仍保留，仅用于应急。

## 为什么仍有一次人工动作

外部云账户不能由 Codex 在没有你授权的情况下创建或控制。Cloudflare 浏览器授权和 iPhone 首次连接各做一次；之后的日常闭环没有人工动作。

## 第一步：授权 Cloudflare

双击：

    D:\CodexProjects\deploy-life-log-v2-20260805\scripts\authorize-cloudflare.cmd

浏览器打开后登录或注册 Cloudflare，并允许 Wrangler。授权页面显示成功后，回到 Codex 告诉它“授权完成”。

不要把 Cloudflare 密码、验证码或同步口令发到聊天里。

## 第二步：自动建库和部署

授权完成后，Codex 运行：

    powershell -NoProfile -ExecutionPolicy Bypass -File "D:\CodexProjects\deploy-life-log-v2-20260805\scripts\setup-cloud-sync.ps1"

脚本会自动：

- 创建或复用 life-log-sync-db；
- 应用 D1 migration；
- 生成高强度私人同步口令；
- 把口令作为 Cloudflare Secret 部署；
- 写入公开但不敏感的 Worker URL；
- 在 D:\LifeLog-Private-Archive 写入私密 Codex 配置；
- 生成只供 iPhone 首次连接使用的激活链接；
- 运行 Worker 健康检查。

## 第三步：发布网页

云端验证通过后，再把 V2.2 提交并推送到 life-log-v2 的 main 分支。GitHub Pages 会继续使用：

    https://b5s474n4f8-ship-it.github.io/life-log-v2/

上线顺序不能反过来，以免日常页面先出现尚未配置的同步入口。

## 第四步：iPhone 连接一次

在 iPhone Safari 打开本机私密文件中的完整链接：

    D:\LifeLog-Private-Archive\life-log-iphone-activation.txt

链接中的 #sync 片段不会发送给 GitHub Pages；App 读取后会立刻从地址栏移除。页面显示“已自动同步”后即可继续日常使用。

如果激活链接在 Safari 打开后显示的是空页面，不要删除任何主屏幕图标。iPhone 的 Safari 与主屏幕 Web App 可能各自保留一份本地存储。
请回到原来有记录的主屏幕图标，打开“备份”，把完整激活链接粘贴到“激活链接或私人同步口令”中，点击“连接同步”。
App 会只提取链接中的口令，并把原有记录上传到空云端；无需手动拆取口令。

这是唯一一次手机连接动作。以后从主屏幕打开，原来的本地数据会自动上传。

## Codex 读取

Codex 只读运行：

    & "C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "D:\CodexProjects\deploy-life-log-v2-20260805\scripts\pull-cloud-backup.mjs"

输出：

- latest：D:\LifeLog-Private-Archive\cloud\life-log-cloud-latest.json
- snapshot：仅当手机数据发生变化时新增
- 公开仓库中不会出现私人内容或私人口令

## 故障边界

- 云端暂时不可用：手机仍在本地保存，并继续自动重试。
- 手机误删 App 或站点数据：再次打开私密激活链接，从云端恢复。
- 同步状态显示错误：先不要清除 Safari 数据；本机记录仍在。
- 更换唯一写入手机：旧手机停止写入后，再在新手机激活，避免两个设备同时编辑。
