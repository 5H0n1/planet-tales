# 星球物语 · Planet Tales

基于 Web 3D 的任务管理应用（毕业设计）：每完成一个任务，星球上长出一棵树；逾期未做，对应区域枯萎。
React + TypeScript + Three.js（React Three Fiber）+ Zustand + Tailwind CSS。

## 链接速查

| 用途 | 链接 |
|---|---|
| 🌐 在线查看（始终是最新版） | https://planet-tales.vercel.app |
| 📦 源码 / 随时修改 | https://github.com/5H0n1/planet-tales |
| 🚀 部署管理面板 | https://vercel.com/5h0n1/planet-tales |

## 随时修改的两种方式

**方式一：浏览器里改（零安装）**
1. 打开仓库 → 按键盘 `.` 进入网页版编辑器（github.dev）
2. 修改文件后左侧提交（Commit）→ 直接推到 main
3. Vercel 自动重新部署，约 1 分钟后线上生效

**方式二：本地改（体验更好）**
```bash
cd planet-tales
npm run dev      # 开发预览，热更新
npm run build    # 生产构建
```
推送代码到 main 即触发自动部署（本机 git 直连 github.com 受限时，用项目根目录的 `push_via_api.py`）。

## 演示参数

- `?theme=day` / `?theme=night`：直达白天 / 夜晚模式
- `?view=tasks|shop|warehouse|album|stats`：直达对应面板页
- `?skipLanding=1`：跳过进入主页；`?panel=0`：默认收起面板看全星球
- `?demo=broken`：演示星球破碎状态

## 已实现功能（v5 = v4 经济系统 + AI 凭证审核）

- **AI 完成凭证审核**：点击完成任务 → 上传凭证图片（自动压缩至 1024px）→ Vercel Serverless 函数调用视觉大模型审核 → 通过才发星球币并长成大树
- **诚实声明保底**：每任务最多提交 3 次；始终未通过可手动声明完成（半额奖励），任务行有 ⚖️ 标记
- **演示模式**：未配置 AI Key 或 `?demo=mock` 时走本地模拟审核；`?demo=proof` 自动打开凭证弹窗（答辩用）
- 任务 ↔ 星球映射：本月完成 = 大树、待办 = 发光种子、逾期 = 枯萎
- 生长动画、星球五阶段进化（繁荣度驱动）
- **繁荣度百分比制**：上限 1000 点 = 100%，面板与报告均以 % 显示
- **紧急程度三级**（🌱普通 / ⚡紧急 / 🔥特急，用户自定义）
- **完成难度 1-5 级**（简单/普通/困难/艰难/★史诗）：时间越紧、紧急度越高，难度越大
- **星球币 🪙 按难度奖励**：+6/+10/+15/+22/+30；删除/撤销任务不影响任何数值
- **星球商店**：用星球币购买 6 种装饰物（🌷🏮🎡🌈💎🌠），价格 10–240 币
- **仓库（纯库存 + 手动放置）**：已购物品随时可亲手放置到星球（消耗 1 件），按附加值增加繁荣度
- **图鉴**：繁荣度里程碑（10/30/50/70/100%）自动解锁，奖励专属物品 + 星球币
- **月度赛季系统**：繁荣度每月 1 日归零、星球清空，历史月归档可查
- **月度统计系统**：报告页内 12 格月度日历（数字 + %，最佳月 ⭐）+ 月度明细（繁荣度/完成数/赚币/放置数）
- 逾期惩罚：未完成且逾期的任务每月 -5 繁荣度；繁荣度为 0 且有逾期 → 星球停转 + 破碎警告
- 进入主页（植物系仪式入口，Enter 过场动画）
- 待机模式（30 秒无操作进入氛围巡航，动鼠标唤醒）
- 完成音效（Web Audio 合成，可开关）· 昼夜模式 · 萤火虫/星空
- localStorage 持久化（v4 数据格式，自动迁移 v3 数据），刷新不丢数据

## AI 凭证审核配置（可选）

1. 到 https://platform.moonshot.cn 申请 API Key（新用户有免费额度）
2. Vercel 项目 → Settings → Environment Variables 添加 `MOONSHOT_API_KEY`
3. 重新部署即可生效；不配也能用（自动降级为演示模式）

审核函数在 `api/verify.ts`，模型可用 `MOONSHOT_MODEL` 环境变量更换。

## 目录说明

```
src/
├── engine.ts        # 核心映射引擎：任务列表 → 星球状态（论文核心）
├── store.ts         # Zustand 全局状态：任务/星球币/库存/图鉴/月度归档
├── sound.ts         # Web Audio 合成音效
├── hooks/useIdle.ts # 待机检测
├── types.ts         # 数据结构：物品/商店/图鉴/繁荣度常量
└── components/
    ├── PlanetScene.tsx  # 3D 星球场景
    ├── TaskPanel.tsx    # 主面板：任务/商店/仓库/图鉴/报告五个页签
    ├── Shop.tsx         # 星球商店（星球币购买）
    ├── Warehouse.tsx    # 仓库（库存 + 手动放置到星球）
    ├── Album.tsx        # 图鉴（繁荣度里程碑解锁）
    ├── StatsPanel.tsx   # 星球体检报告 + 月度日历 + 月度统计明细
    ├── Landing.tsx      # 植物系进入主页
    └── Botanical.tsx    # 藤蔓/飘叶/嫩芽装饰
```
