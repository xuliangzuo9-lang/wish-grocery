# 免费部署路线

这套项目现在支持两种存储模式：

- 本地 `data/site-store.json`
- Supabase 免费数据库

如果你想正式公开给异地用户访问，同时尽量避免手机把临时测试域名判成可疑链接，推荐使用：

- Render Free Web Service
- Supabase Free Project

## 1. 创建 Supabase 免费项目

1. 在 Supabase 控制台创建一个新项目
2. 打开 SQL Editor
3. 执行 [supabase-schema.sql](/D:/Lenovo/Documents/目标商场/supabase-schema.sql) 里的 SQL
4. 记录两个值：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 2. 部署到 Render 免费 Web Service

1. 把当前项目上传到 GitHub
2. 在 Render 新建 Web Service
3. 连接你的 GitHub 仓库
4. 构建命令填 `npm install`
5. 启动命令填 `npm start`
6. 环境变量填：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

也可以直接使用 [render.yaml](/D:/Lenovo/Documents/目标商场/render.yaml)。

## 3. 首次登录

部署成功后，站点会自动创建默认管理员：

- 用户名：`admin`
- 密码：`admin123456`

登录后台后请立即修改密码。

## 4. 现在已经云同步的内容

- 登录与会话
- 注册申请与管理员审核
- 每个用户自己的愿望、收入记录、主题设置、主页排序

也就是说，用户换设备登录后，自己的愿望数据也会跟着账号走。

## 5. 这个免费方案的限制

- Render Free 可能有冷启动，第一次打开会慢几秒
- Supabase Free 长时间完全没人使用时，项目可能会暂停
- 这是“免费可上线试运行”方案，不是高并发生产方案

## 6. 为什么这个方案比临时隧道更适合分享

- 会得到固定的正式公网域名
- 不再依赖 `trycloudflare.com` 之类的临时测试地址
- 手机浏览器或聊天软件把它判成奇怪临时链接的概率会低很多
