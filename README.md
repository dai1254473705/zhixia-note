# 知夏笔记 (Zhixia Note)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.12-green.svg)
![Electron](https://img.shields.io/badge/Electron-38.2.1-blueviolet.svg)
![React](https://img.shields.io/badge/React-19.1.1-61dafb.svg)

[中文](#中文介绍) | [English](#english-introduction)

---

## 中文介绍

**知夏笔记** 是一款基于 **Electron + React + TypeScript** 打造的现代化、本地优先的 Markdown 笔记应用。它结合了本地存储的安全性和 Git 的版本控制能力，为您提供极致的写作体验。

我们坚持 **"本地优先"** 的理念，您的所有笔记都存储在您的设备上，并通过 Git 仓库进行同步。您拥有数据的完全控制权，无需担心第三方云服务的隐私泄露或服务中断风险。

### ✨ 核心特性

- **🔒 数据主权 (Data Sovereignty)**
  - 所有数据存储在本地，拥有完全控制权。
  - 无第三方服务器依赖，隐私绝对安全。

- **🔄 Git 同步 (Git Sync)**
  - 基于 `.zhixia-note` 目录结构。
  - 支持与 GitHub 私有/公开仓库无缝同步。
  - 自动处理版本冲突，支持多设备协作。

- **🔐 安全加密 (Security)**
  - 支持 **AES-256-GCM** 军用级加密算法。
  - 敏感笔记和附件一键加密，密钥仅存储在本地。

- **🎨 现代化 UI (Modern UI)**
  - 基于 **Tailwind CSS + Headless UI** 精心打造。
  - 内置多款主题：清新绿、沉稳黑、护眼模式等。
  - 丝滑的交互体验，支持拖拽排序。

- **📝 专业写作 (Pro Writing)**
  - 强大的 Markdown 编辑器，支持 GFM 标准。
  - 内置 **Mermaid** 流程图渲染支持。
  - 支持代码高亮（100+ 语言）、数学公式、任务列表。

- **⚡ 极简体验 (Minimalist)**
  - 严格的 **三级目录限制**，防止知识库臃肿，专注于写作本身。
  - 极速启动，低内存占用。

### 📸 界面预览

| 编辑模式 | 主题切换 |
|:---:|:---:|
| ![编辑模式](mdimg/iShot_2026-01-20_13.32.27.png) | ![主题切换](mdimg/iShot_2026-01-20_13.32.44.png) |

| 设置与同步 |
|:---:|
| ![设置与同步](mdimg/iShot_2026-01-20_13.32.58.png) |

### 🚀 快速开始

#### 安装
目前支持 macOS (Apple Silicon/Intel)。请在 Release 页面下载最新的 `.dmg` 安装包。

#### 初始化
首次启动时，您可以选择：
1. **关联 GitHub 仓库**：输入仓库地址和 Token，自动克隆笔记。
2. **创建本地项目**：在本地初始化一个新的笔记本仓库。
3. **打开本地目录**：打开已有的 Git 笔记本仓库。

#### 常用快捷键
- `Cmd + N` : 新建笔记
- `Cmd + S` : 保存笔记
- `Cmd + E` : 导出笔记
- `Cmd + Shift + I` : 打开开发者工具 (DevTools)

---

## English Introduction

**Zhixia Note** is a modern, local-first Markdown note-taking application built with **Electron + React + TypeScript**. It combines the security of local storage with the powerful version control capabilities of Git to provide you with the ultimate writing experience.

We adhere to the **"Local-First"** philosophy. All your notes are stored on your device and synchronized via Git repositories. You have complete control over your data without worrying about privacy leaks or service interruptions from third-party cloud services.

### ✨ Key Features

- **🔒 Data Sovereignty**
  - All data is stored locally. You own your data completely.
  - No reliance on third-party servers; absolute privacy.

- **🔄 Git Sync**
  - Based on the `.github-notebook` directory structure.
  - Seamless synchronization with GitHub private/public repositories.
  - Automatic conflict resolution and multi-device collaboration support.

- **🔐 Security & Encryption**
  - Supports **AES-256-GCM** military-grade encryption.
  - One-click encryption for sensitive notes and attachments; keys stored locally only.

- **🎨 Modern UI**
  - Beautifully crafted with **Tailwind CSS + Headless UI**.
  - Built-in themes: Fresh Green, Calm Black, Eye-care mode, etc.
  - Smooth interaction with drag-and-drop support.

- **📝 Professional Writing**
  - Powerful Markdown editor with GFM support.
  - Built-in **Mermaid** diagram rendering.
  - Syntax highlighting (100+ languages), math formulas, and task lists.

- **⚡ Minimalist Experience**
  - Strict **3-level directory limit** to keep your knowledge base organized and focused.
  - Fast startup and low memory usage.

### 💻 Development

If you want to contribute or build from source:

```bash
# Clone the repository
git clone https://github.com/your-repo/zhixia-note.git

# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production (macOS)
yarn build
```

---

## 📄 Open Source License (开源协议)

**MIT License**

Copyright (c) 2026 知夏笔记 (Zhixia Note)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
