# Frontend Demo (Supabase Auth)

本 demo 集成了 Supabase 登录（邮箱魔法链接 + Google/Apple OAuth），并用 shadcn/ui 渲染登录表单。

## 前置要求
- Node 18+
- pnpm 9+
- 已在 Supabase 控制台创建项目，拿到 Project URL 与 anon key
- OAuth（可选）：在 Supabase -> Authentication -> Providers 中启用 Google/Apple，并将回调 URL 配置为：
  - 本地开发：`http://localhost:5173`

## 安装依赖
请在仓库根目录执行以下命令（不要在助理中执行）：

```bash
# 切到前端 demo 包
cd frontend-apps/demo

# 安装依赖（新增了 @supabase/supabase-js）
pnpm add @supabase/supabase-js
```

## 环境变量
复制示例文件，然后填入 Supabase 项目配置：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 启动开发服务器

```bash
pnpm dev
```

打开 `http://localhost:5173`，使用邮箱登录（魔法链接）或 Google/Apple 登录。

## 说明
- 登录成功后页面会显示当前用户邮箱，并提供 “退出登录” 按钮。
- OAuth 登录回跳后会自动完成 code 交换并清理 URL 参数。
- 目前只是登录门卫，后续会把 access_token 传给后端 /api/action 等接口。
