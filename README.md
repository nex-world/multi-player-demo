多人游戏最小化 demo（前端）

## 快速开始

1. 安装依赖并启动开发服务器

	- 使用 pnpm：`pnpm i && pnpm dev`
	- 或 npm：`npm i && npm run dev`

2. 配置环境变量（必需）

	将 `.env.example` 复制为 `.env.local` 并填写：

	- VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY：用于登录/鉴权。
	- VITE_WEBSOCKET_URL：多人房间的 WebSocket 服务地址（例如 wss://your-host/ws 或 ws://localhost:8787）。

	缺失时的行为：
	- 未配置 Supabase：首页会显示清晰的引导，而不会抛错。
	- 未配置 WebSocket：房间页会提示需要配置 VITE_WEBSOCKET_URL 且“连接”按钮不可用。

## 路由

- `#/` 登录页 + 欢迎页
- `#/room` 房间演示页
- `#/auth/error` 登录错误页