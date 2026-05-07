# DevText 工具箱

> 开发者文本工具箱 Chrome 扩展，支持 JSON 格式化/修复/可视化、文本差异对比。

## ✨ 功能特性

### JSON 格式化

- **JSON 格式化 / 压缩** — 一键美化或压缩 JSON 文本
- **语法错误检测和自动修复建议** — 智能识别常见错误并给出修复方案
- **转义字符处理** — 自动识别和展示转义序列
- **可视化 JSON 树形展示** — 支持节点展开/收起，直观查看数据结构
- **拖拽文件加载** — 直接拖拽 JSON 文件到界面即可加载

### 文本差异对比

- **逐行对比（Side-by-Side）模式** — 左右分栏对照查看差异
- **内联对比（Inline）模式** — 上下排列展示变更
- **行内字符级差异高亮** — 支持字符级/词级粒度切换，精准定位修改内容
- **Git 风格的差异合并** — 支持 `>>` / `<<` 按钮，逐行合并到对侧
- **合并操作撤销** — 支持 `Command+Z` / `Ctrl+Z` 撤销合并操作
- **差异统计** — 实时显示新增/删除行数
- **一键复制** — 快速复制对比结果

## 📸 截图

<!-- TODO: 添加截图 -->

## 📦 安装使用

### 方式一：从源码构建

```bash
git clone https://github.com/Free-Geter/DevText.git
cd devtext-toolbox
npm install
npm run build
```

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目中的 `extension/` 文件夹

### 方式二：直接下载

1. 从 [Releases](https://github.com/Free-Geter/DevText/releases) 下载最新的 zip 包
2. 解压到本地文件夹
3. 按上述步骤加载到 Chrome

## 🛠 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建产物
npm run preview
```

## 🧱 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Vue | 3.4+ | 前端框架 |
| Vite | 6.0+ | 构建工具 |
| TypeScript | 5.6 | 类型系统 |
| Tailwind CSS | 3.4 | 原子化样式 |
| diff | 9.0 | 文本差异对比引擎 |

## 📄 License

[MIT](./LICENSE)
