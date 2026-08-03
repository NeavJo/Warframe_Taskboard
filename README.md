# Warframe Taskboard

> 以**任务看板**与**攻略收集**为核心的 Warframe 玩家多合一工具包。

还在为每天不知道上线干甚么、每周漏掉周常、查攻略，逛wm要在多个网站间反复切换而烦恼？Warframe Taskboard 把这些需求整合到一个轻量级 Web 应用中，让你既高效又沉浸地管理你的 Tenno 日常。

---

## 核心功能

### 任务看板
- **每日日常** 与 **每周周常** 双面板展示
- 任务**拖拽排序**（左侧手柄拖动），管理模式下可编辑/删除
- 完成/未完成状态自动统计，进度条可视化
- **自动重置**：每日 0 点重置日常、每周指定工作日重置周常（仅未完成项重置）

### 定时提醒
- 添加带日期时间的提醒项，支持"X 小时后"快捷设置
- 到达预定时间后卡片**自动激活**
- 点击激活的卡片即可标记完成

### 仲裁任务
- 基于轮换调度表实时显示当前仲裁节点与倒计时
- 今日高价值仲裁（S/A+ 评级）突出展示
- 未来 12 小时仲裁列表预览
- **一键添加提醒**：每日自动将高价值仲裁添加为临时提醒，不再错过

### 便签
- 创建多张便签卡片，每张含标题、颜色主题、事项列表
- 事项支持勾选/取消，进度条自动更新
- 编辑器内支持拖拽排序事项
- 勾选事项时增量更新 DOM，无闪烁

### 市场
- **物品搜索**：中文/英文双向模糊匹配自动补全
- **实时价格**：连接 Warframe Market 官方 API v2，查询在线卖单（最多 5 条最低价报价）
- **报价交互**：点击任一报价可切换选中卖家，"复制白金私聊"跟随选中卖家
- **收藏功能**：收藏常用物品（目前最多 6 个），一键跳转查价，数据随导出/导入同步

### 内置浏览器
- 默认打开**灰机 Wiki**，方便查阅中文攻略
- 其他站点（如官方 Wiki、市场）以**新标签页**方式跳转，因为它们不支持iframe

### 设置与同步
- **JSON 导出/导入**：含看板任务、提醒、便签、市场收藏的完整数据
- （可选）**云端同步**：通过 GitHub Gist 实现跨设备同步（需配置 Token + Gist ID）
- **仲裁自动提醒开关**：控制每日是否自动添加仲裁提醒
- 纯本地存储（localStorage）

---

## 技术栈

- **HTML5 / CSS3 / 原生 JavaScript（ES6+）**
- **零构建工具**：无 Webpack/Vite，开箱即用
- **零运行时依赖**：仅引入 Google Material Icons 字体
- **本地存储**：基于 `localStorage` 持久化所有数据
- **图片缓存**：IndexedDB 缓存市场物品缩略图
- **SPA 架构**：单页应用，7 个页面视图切换不刷新

---

## 快速开始

### 使用我的Github Pages

[Warframe Taskboard](https://neavjo.github.io/Warframe_Taskboard/)

### Fork到自己仓库设置Github Pages运行

### 本地运行

#### 环境要求

- **Python 3.8+**（运行开发服务器和资源下载脚本）仅使用标准库（`http.server`、`urllib`、`ssl` 等）
- **curl**（Windows 10+ 自带，用于下载资源文件）

#### 方式一：开发服务器（推荐）

先运行 `download-market-resources.bat` 下载所需数据（物品清单、仲裁数据、缩略图），之后双击运行 `dev-server.bat`，浏览器访问 `http://localhost:8082/`。该方式启动带 CORS 代理的 Python 服务器，市场查价 API 可正常工作。

#### 方式二：直接打开 index.html

先运行 `download-market-resources.bat` 下载所需数据（物品清单、仲裁数据、缩略图），之后直接双击 `index.html` 即可使用。

> `file://` 协议下市场查价的**物品列表**和**缩略图**均从本地读取（支持离线浏览），但**实时报价查询**因浏览器安全策略**不可用**，需通过 `dev-server.bat` 或部署到 GitHub Pages 使用。

#### 资源自动更新（推荐）

`download-market-resources.bat` 负责下载/更新物品清单、仲裁数据和缩略图。建议通过 **Windows 任务计划程序** 每日自动运行：

1. 打开"任务计划程序"（`taskschd.msc`）
2. 创建基本任务 → 触发器选"每天" → 设定时间（如每天 14:00）
3. 操作选"启动程序" → 选择 `download-market-resources.bat`
4. 创建后在属性中勾选"如果任务运行时间超过以下时间则停止"，设为 **1 小时**

> 该脚本会请求 Warframe Market API 和 arbi.wf.wiki 下载最新数据，偶尔因网络波动耗时较长，设 1 小时强制终止作为保底。

> **Linux 用户**：本项目作者不怎么接触 Linux，未提供 `.sh` 脚本。请参照 `download-market-resources.bat` 和 `dev-server.bat` 的源码自行用 `curl` + `python -m http.server` 搞定。

### 使用说明

1. 打开应用后默认进入"看板"
2. 点击右上角"管理"按钮可新增、编辑、拖拽排序任务
3. 切换到"提醒"页添加定时提醒
4. 切换到"仲裁"页查看当前仲裁任务
5. 切换到"便签"页创建待办清单
6. 切换到"市场"页查价
7. 切换到"浏览器"查阅攻略
8. 切换到"设置"配置云端同步或导出/导入数据

---

## 项目结构

```
wf-taskboard-web/
├── index.html              # SPA 入口
├── dev-server.bat          # 开发服务器启动脚本（推荐）
├── dev-server-proxy.py     # 带 CORS 代理 + 连接池的 Python 服务器
├── dev-server-test-github.bat  # 无代理静态服务器（模拟 GitHub Pages）
├── download-market-resources.bat  # 下载/更新资源（物品清单+仲裁+缩略图）
├── css/                    # 样式系统
│   ├── theme.css           # 主题变量
│   ├── animations.css      # 动画关键帧
│   ├── layout.css          # 布局框架
│   ├── components.css      # 通用组件（卡片/按钮/对话框/进度条）
│   ├── pages/              # 各页面专属样式
│   │   ├── taskboard.css   # 看板页
│   │   ├── reminder.css    # 提醒页
│   │   ├── arbitration.css # 仲裁页
│   │   ├── notes.css       # 便签页
│   │   ├── browser.css     # 浏览器页
│   │   ├── market.css      # 市场查价页
│   │   └── settings.css    # 设置页
│   └── responsive.css      # 响应式适配
├── js/                     # 脚本逻辑（按功能模块拆分）
│   ├── utils.js            # 工具函数
│   ├── store.js            # 数据持久化 + 导出/导入
│   ├── sync_gist.js        # GitHub Gist 云端同步
│   ├── components.js       # 组件工厂（对话框/任务卡片/面板）
│   ├── taskboard.js        # 看板页
│   ├── reminder.js         # 提醒页
│   ├── arbitration_data.js # 仲裁数据加载与查询
│   ├── arbitration.js      # 仲裁页
│   ├── browser.js          # 浏览器页
│   ├── notes.js            # 便签页
│   ├── wf_market.js        # 市场查价页
│   ├── settings.js         # 设置页
│   └── main.js             # 应用入口（7页面导航）
├── data/                   # 数据目录（GitHub Action 每日自动更新）
│   ├── wf_market_items.json    # WM 物品清单
│   ├── arbys.schedule.v2.json  # 仲裁调度表
│   ├── arbys.nodes.zh.json     # 仲裁节点（中文）
│   ├── tierlist.default.json   # 仲裁评级表
│   ├── *.js                    # JSON 的 JS wrapper（file:// 协议加载用）
│   └── img/                    # 物品缩略图
├── README.md               # 本文件
└── ARCHITECTURE.md         # 架构与维护指南
```

详细的文件组织逻辑、拆分原则、维护规范请参阅 [ARCHITECTURE.md](./ARCHITECTURE.md)。

---

## 项目背景

本项目最初为 Flutter 应用（Windows .exe + Android .apk 双端），后因为安卓端操蛋的编译失败迁移至 Web 平台以扩大可访问性。Web 版在保留原有看板核心功能的基础上新增了提醒、仲裁、便签、市场查价、浏览器等功能模块，整体体积约 0.6MB（不含`./data`里约16MB的全量 JSON 数据和PNG）

---

## 许可

本项目为个人玩家工具，仅供学习与个人使用。Warframe 相关版权归 Digital Extremes 所有。
