# Product Requirements Document
# FinContent AI — 财经自媒体人机协作内容生产系统

**版本**：v1.0  
**日期**：2026年3月  
**用途**：交付Claude Code开发使用

---

## 1. 产品概述

### 1.1 产品定位

帮助有真实财经判断力的人（基金经理、分析师、投研人员、财经从业者），制作有传播力的财经视频。用户不需要任何视频制作经验，从选题到成片，全程在平台内完成。

**核心理念**：AI负责效率，人负责灵魂。

### 1.2 目标用户

- 基金经理、分析师、投研人员
- 有一线产业/投资经验、想建立个人影响力的财经从业者
- 有专业财经判断但零内容制作经验的人

### 1.3 产品语言

英文界面为主（面向YouTube英文财经内容市场）

---

## 2. 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端 | React + TypeScript |
| 后端 | FastAPI (Python) |
| 数据库 | PostgreSQL |
| 热点搜索 | Gemini API（with Google Search grounding） |
| LLM | Claude API（脚本生成、观点打磨、场景拆解） |
| 语音转文字 | Whisper API |
| 图片生成 | DALL-E API 或 Flux API |
| 公司Logo | Brandfetch API |
| 财务数据 | yfinance（股价/市值） + Financial Modeling Prep API（财务报表） |
| 数据图表 | ECharts |
| 配音TTS | Gemini TTS API |
| 视频合成 | FFmpeg |

---

## 3. 叙事模板库

系统内置5种高传播力叙事模板，在脚本生成时AI自动匹配最适合的模板，用户也可手动切换。

### 模板1：反常识型（Counterintuitive）
**结构**：颠覆认知的结论 → 大众误解是什么 → 数据证明真相 → 深层原因分析 → 用户启示  
**Hook示例**："Buffett has underperformed the S&P 500 for five years — and that actually proves he's right."  
**适合话题**：市场认知偏差、被误解的公司、反直觉的经济数据

### 模板2：焦虑驱动型（Anxiety-Driven）
**结构**：制造危机感 → 量化损失 → 分析根因 → 给出应对框架  
**Hook示例**："Over the past 18 months, people holding this asset class quietly lost 30% of their purchasing power."  
**适合话题**：通胀、汇率、行业衰退、某类资产风险

### 模板3：公司解剖型（Company Breakdown）
**结构**：一个反直觉的业务现象 → 拆解商业模式 → 关键财务数据 → 核心竞争力判断 → 风险和机会  
**Hook示例**："This company loses $2 billion a year. So why is Wall Street still buying?"  
**适合话题**：个股分析、商业模式解读、行业龙头研究

### 模板4：趋势预判型（Trend Forecast）
**结构**：当前信号 → 历史类比 → 趋势推演 → 受益和受损方 → 判断结论  
**Hook示例**："There's one data point from 1999 that looks almost identical to today — and you know what happened next."  
**适合话题**：宏观经济走势、行业拐点、市场周期

### 模板5：数据揭秘型（Data Reveal）
**结构**：一个震惊的数字 → 拆解这个数字背后 → 和常识对比 → 意味着什么  
**Hook示例**："Apple bought back $24 billion of its own stock last quarter — more than the GDP of some countries."  
**适合话题**：财报解读、行业数据、宏观数字

---

## 4. 用户旅程与功能详细说明

### Step 1：选题发现（Topic Discovery）

#### 4.1.1 热点面板

用户进入平台，首先看到一个热点面板，显示当天最新财经热点。

**数据获取逻辑**：
- 调用Gemini API（开启Google Search grounding）
- 预设4-5个宏观查询词，每天定时执行一次，结果缓存
- 查询词示例：
  - "top financial news today"
  - "stock market news today"
  - "top earnings news today"
  - "breaking business news today"
- 多个查询词的结果合并去重

**每条热点显示**：
- 话题标题
- AI摘要（100-200字，中立客观）
- 原始信息来源列表（带可点击的外部链接）

**用户操作**：
- 点击某条热点 → 进入Step 2
- 或点击"自定义选题"按钮 → 弹出输入框

#### 4.1.2 自定义选题

用户自己输入一个选题，系统调用Gemini API重新搜索该话题，返回：
- 相关背景摘要
- 原始信息来源链接列表

确认后进入Step 2。

---

### Step 2：Idea生成（Idea Generation）

用户选定话题后，系统基于话题背景信息，调用Claude API生成一个内容Idea。

**Idea内容包含**：
- 推荐叙事模板（从5种模板中选最适合的，并说明理由）
- 核心论点（1-2句话）
- 建议的切入角度
- 建议的Hook（前15秒开场）

**用户操作**：
- 接受Idea → 进入Step 3
- 点击"换个角度"→ 系统重新生成
- 手动修改Idea内容后继续

**UI设计要点**：
- 显示推荐的叙事模板名称和简短说明
- 用户可在下拉菜单里手动切换模板

---

### Step 3：观点输入与打磨（Opinion Input & Refinement）

#### 4.3.1 观点输入

用户输入自己的核心观点和判断。

**输入方式**：
- 文本框直接输入
- 点击麦克风按钮录音 → 调用Whisper API转文字 → 填入文本框 → 用户可检查和修改

#### 4.3.2 AI提问（观点打磨）

用户提交观点后，系统结合用户观点 + 话题背景信息，调用Claude API生成2-3个针对性问题，帮助用户把逻辑说得更严密。

**问题示例**（假设用户认为阿里无法赢得本地生活）：
- "Do you see the barrier as a density problem or an execution problem?"
- "Is there specific data from Meituan's tier-3 city expansion that supports your view?"

用户文字回答问题后，可追加补充观点，然后进入下一步。

**注意**：只进行一轮问答，不过度打扰用户。

#### 4.3.3 选择视频时长

用户选择目标视频时长：
- 3分钟（约450词，6-8个场景）
- 5分钟（约750词，10-12个场景）
- 8分钟（约1200词，16-18个场景）

点击"生成脚本"按钮 → 进入Step 4。

---

### Step 4：场景拆解与脚本生成（Scene Generation）

系统调用Claude API，基于以下输入生成完整场景表格：
- 选定的话题背景
- 用户的观点和打磨后的判断
- 选定的叙事模板结构
- 选定的视频时长（决定场景数量）

**生成内容**：每个场景包含：
- `scene_type`：场景类型（`image` 或 `chart`，AI自动判断）
- `description`：图片生成提示词（英文，详细描述画面内容）
- `narration`：旁白文字（按时长均匀分配词数）

**场景类型判断规则**：
- 如果narration涉及具体公司财务数据（营收、利润、EPS、增长率等）→ 标记为`chart`
- 其他情况 → 标记为`image`

---

### Step 5：素材工作台（Asset Workstation）

核心交互界面，场景表格式布局。

#### 4.5.1 表格结构

每行代表一个场景，列如下：

| 列 | 内容 |
|----|------|
| # | 场景编号 |
| Type | 场景类型标签（Image / Chart），用户可手动切换 |
| Description | 图片提示词文本框，用户可编辑 |
| Narration | 旁白文字文本框，用户可编辑 |
| Image | 图片预览区 + 操作按钮 |
| Audio | 配音操作区 |

#### 4.5.2 Image列交互

**Image类型场景**：
- 显示"Generate Image"按钮
- 点击后调用DALL-E/Flux API，根据description生成图片
- 生成后显示图片缩略图
- 提供"Regenerate"按钮重新生成
- 特殊情况：
  - 如果description中包含公司名称 → 优先调用Brandfetch API获取Logo
  - 如果用户需要人物图 → 显示"Upload Image"按钮，用户自行上传

**Chart类型场景**：
- 显示"Edit Data"按钮
- 点击后弹出数据确认弹窗（见4.5.3）
- 数据确认后显示ECharts渲染的图表预览

#### 4.5.3 数据确认弹窗（Chart场景专用）

弹窗内容：

1. **图表参数区**（AI预填，用户可修改）：
   - 指标选择（多选下拉）：Revenue / Net Income / EPS / Gross Margin / 其他
   - 时间维度（单选）：Quarterly / Annual
   - 时间范围（滑动条或下拉）：起始年份 - 结束年份
   - 图表类型（单选）：Bar / Line / Combined

2. **数据表格区**：
   - 行：时间维度（如2022Q1、2022Q2…）
   - 列：选中的指标
   - 数据由系统自动从yfinance/FMP拉取并填充
   - 每个单元格可直接点击编辑
   - 支持从财报复制数据粘贴

3. **操作按钮**：
   - "Confirm & Generate Chart"：确认数据，生成ECharts图表
   - "Cancel"：关闭弹窗

#### 4.5.4 Audio列交互

每个场景的Audio列提供两种方式：

- **AI配音**：点击"Generate Audio"按钮 → 调用Gemini TTS API生成配音
  - 顶部提供全局Voice设置（音色选择下拉菜单）
  - 生成后显示播放按钮供试听
  - 提供"Regenerate"按钮

- **用户录音**：点击麦克风图标 → 开始录音
  - 显示narration文字供用户对着念
  - 录音完成后显示波形和播放按钮
  - 提供"Re-record"按钮

#### 4.5.5 批量操作

表格顶部提供：
- "Generate All Images"：批量生成所有场景的图片
- "Generate All Audio"：批量生成所有场景的配音

---

### Step 5.5：视频规格选择（Video Format）

在进入素材工作台之前，或在工作台顶部，用户选择视频规格：

| 规格 | 尺寸 | 适用平台 |
|------|------|---------|
| Horizontal 16:9（YouTube Landscape） | 1920×1080 | YouTube |
| Vertical 9:16（Reel / Shorts） | 1080×1920 | YouTube Shorts / Instagram Reels / TikTok |

**影响范围**：
- 图片生成时的宽高比参数（DALL-E支持指定比例）
- ECharts图表的渲染尺寸
- FFmpeg合成时的输出分辨率
- 封面Thumbnail的尺寸

---

### Step 6：视频合成（Video Synthesis）

所有场景的图片和配音确认完毕后，用户点击"Generate Video"按钮。

**合成逻辑（FFmpeg）**：
1. 按场景顺序，将每个场景的静态图片 + 配音拼接
2. 根据配音时长决定该场景图片的显示时长
3. 自动生成字幕（从narration文字生成SRT文件，嵌入视频）
4. 输出完整MP4视频

**完成后用户可**：
- 在网站内直接预览视频
- 下载成品MP4视频
- 点击"Download All Assets"打包下载所有原始素材（图片文件、音频文件、SRT字幕文件），供导入剪映等外部工具做进一步编辑

---

### Step 7：YouTube Metadata 生成

视频合成完成后，提供一个独立的Metadata区块，帮助用户完成发布前的最后准备。

#### 4.7.1 YouTube Title
- 点击"Generate Title"按钮 → 调用Claude API，基于话题、观点、叙事模板生成3个候选标题
- 用户选择或手动编辑
- 标题生成原则：符合选定叙事模板的Hook逻辑，吸引点击

#### 4.7.2 YouTube Description
- 点击"Generate Description"按钮 → 调用Claude API生成完整视频描述
- 描述内容包含：视频核心论点摘要、关键数据点、相关话题标签（#hashtags）
- 用户可在文本框内直接编辑

#### 4.7.3 YouTube Thumbnail（封面）
- 提供图片生成模型选择下拉菜单（如：DALL-E / Gemini Image / Flux）
- 点击"Generate Thumbnail"按钮 → 调用选定模型生成封面图
- 封面尺寸根据视频规格自动适配：
  - 横向视频：1280×720（YouTube标准封面）
  - 竖向视频：1080×1920（Shorts封面）
- 提供"Regenerate"按钮重新生成
- 提供下载按钮单独下载封面图

---

## 5. 素材来源汇总

| 素材类型 | 来源 | 说明 |
|---------|------|------|
| 普通配图（说明图、氛围图） | DALL-E / Flux API | 根据description生成 |
| 公司Logo | Brandfetch API | 根据公司名/域名获取 |
| 人物图 | 用户自行上传 | 系统显示占位符提示 |
| 数据图表 | ECharts + yfinance + FMP | 用户确认数据后渲染 |
| 配音 | Gemini TTS API / 用户录音 | 用户选择 |

---

## 6. 传播力保障机制

传播力不是在视频生成后才考虑的，而是贯穿在每个环节：

| 环节 | 传播力保障措施 |
|------|-------------|
| 选题发现 | 优先推荐有情绪张力、与个人财富相关的话题 |
| Idea生成 | 推荐最适合该话题的叙事模板；Hook优先设计 |
| 脚本生成 | 严格按照模板结构生成；前15秒（Hook场景）重点打磨 |
| 迭代优化 | 后期根据用户视频真实表现数据，持续优化模板推荐逻辑 |

---

## 7. MVP开发范围

MVP阶段优先实现以下核心流程，确保完整跑通：

### 必须实现（P0）
- [ ] 热点面板（Gemini web search，4-5个预设查询词，每日缓存）
- [ ] 自定义选题输入
- [ ] Idea生成（Claude API，含模板推荐）
- [ ] 观点输入（文本框 + Whisper语音转文字）
- [ ] AI提问打磨（Claude API，1轮问答）
- [ ] 视频时长选择
- [ ] 视频规格选择（16:9 / 9:16）
- [ ] 场景表格生成（Claude API，含场景类型自动判断）
- [ ] Image类场景：DALL-E图片生成（含宽高比参数）
- [ ] Chart类场景：数据确认弹窗 + yfinance数据拉取 + ECharts渲染
- [ ] Audio：Gemini TTS配音生成
- [ ] 视频合成（FFmpeg拼接，含字幕，含规格适配）
- [ ] YouTube Title生成（Claude API）
- [ ] YouTube Description生成（Claude API）
- [ ] YouTube Thumbnail生成（DALL-E/Gemini Image）
- [ ] 成品视频下载
- [ ] 素材打包下载

### 次优先（P1）
- [ ] Brandfetch Logo获取
- [ ] 用户录音功能
- [ ] 人物图占位符提示和上传
- [ ] FMP财务数据（补充yfinance的不足）
- [ ] 批量生成图片/配音

### 暂不做（放第二期）
- [ ] 静态图片 → 3-5秒短视频片段生成（Kling/Runway API）
- [ ] 用户数据存储和历史记录
- [ ] 多用户系统和权限管理

---

## 8. 关键交互原则

贯穿整个产品的交互设计原则：

> **AI负责初稿，用户负责确认和纠错。**

具体体现：
- 场景类型：AI自动判断，用户可手动切换
- 图表数据：AI自动拉取，用户可编辑和补充
- 图表参数（指标/维度/时间范围）：AI预填建议，用户可修改
- 脚本内容：AI生成，用户可编辑每个场景的Description和Narration

---

## 9. 页面结构概览

```
/                        → 首页（热点面板）
/topic/:id               → 话题详情（Idea生成 + 观点输入）
/workspace/:projectId    → 素材工作台（视频规格选择 + 场景表格）
/preview/:projectId      → 视频预览、Metadata生成和下载
```

---

## 10. API接口清单

### 后端需实现的接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/topics` | GET | 获取今日热点列表（从缓存读取） |
| `/api/topics/search` | POST | 自定义选题搜索（调用Gemini） |
| `/api/idea/generate` | POST | 生成Idea（调用Claude） |
| `/api/opinion/refine` | POST | 观点打磨提问（调用Claude） |
| `/api/scenes/generate` | POST | 生成场景表格（调用Claude） |
| `/api/image/generate` | POST | 生成单张图片（调用DALL-E） |
| `/api/logo/fetch` | POST | 获取公司Logo（调用Brandfetch） |
| `/api/chart/data` | POST | 拉取财务数据（调用yfinance/FMP） |
| `/api/audio/generate` | POST | 生成配音（调用Gemini TTS） |
| `/api/audio/transcribe` | POST | 语音转文字（调用Whisper） |
| `/api/video/generate` | POST | 视频合成（调用FFmpeg，含视频规格参数） |
| `/api/metadata/title` | POST | 生成YouTube标题（调用Claude） |
| `/api/metadata/description` | POST | 生成YouTube描述（调用Claude） |
| `/api/metadata/thumbnail` | POST | 生成封面图（调用DALL-E/Gemini/Flux） |
| `/api/assets/download` | GET | 打包下载所有素材 |

---

*本文档基于产品方向讨论整理，供Claude Code开发使用。如需继续深化某个模块，可在此文档基础上追加说明。*
