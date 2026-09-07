# 数据构造：从原始请求到 Query＋金标答案

[打开交互演示](https://justcoolpig.github.io/data_construction/pipeline-20260907/)

- [index.html](index.html)：自包含单文件网页。下载后断网可用，无外部脚本、字体或统计请求。
- [flow.png](flow.png)：五栏流程图。构造 Agent 与程序自检双向交互，独立复核先求解后对账，错误按来源反馈。
- [sample.zip](sample.zip)：演示任务的最终 Query、主键 JSON 与两张金标 CSV。用户保存路径标识已隐藏，CSV 原始字节不变。

## 内容

使用 2026-09-07 已完成的佰维存储任务，逐步展示真实对象检索、指标试取差异、四处 Query 调整、模型生成的规格与代码、两轮取数建表、来源核验、新会话独立求解和对账。

可展开 49 次模型响应、68 次工具调用与记录中的思考内容；66 次工具返回按 tool_call_id 配对，其余两次明确标注无对应返回记录，不补造。包含 37 份原始工具证据；令牌、内网地址及服务器绝对路径已隐藏。

两张 CSV 共 110 格：104 格由独立可执行程序对账，其余 6 格为语义核验。此例是修复后的回归样本，不是新题盲测或量产验收。

## Confluence

站点启用 iFrame 宏时，URL 填演示网址，宽度 100%，高度建议 900–1100。站点禁止 iframe 时，插入 PNG 并附上网页网址或 HTML 附件。上传 HTML 附件并不代表站点会执行网页脚本。

[Atlassian 官方说明](https://support.atlassian.com/confluence-cloud/docs/insert-the-iframe-macro/)

本目录为独立展示，不修改仓库既有页面。源任务运行版本：`97e94f333357659d994761cc63ded2ddba33dc41`。运行时间：2026-09-07 10:36:13–10:46:20（北京时间）。
