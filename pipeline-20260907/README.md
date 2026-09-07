# 数据构造链路与真实案例

[打开交互演示](https://justcoolpig.github.io/data_construction/pipeline-20260907/)

- [index.html](index.html)：单文件网页，支持离线打开和转发。
- [flow.png](flow.png)：五栏流程图，包含构造与执行反馈、集中返修和复核纠错。
- [sample.zip](sample.zip)：最终 Query、主键 JSON 与两张金标 CSV。

## 内容

以佰维存储取数任务为例，逐步查看原始请求、对象检索、指标试取、4 处 Query 调整、规格与建表代码、两轮取数、来源检查和独立复核。

保留 49 次模型响应、68 次工具调用与 37 份工具证据。两张 CSV 共 110 格，其中 104 格代码对账、6 格语义核验。凭据、服务器地址与用户路径标识已隐藏。

## Confluence

启用 iFrame 宏时，URL 填演示网址，宽度 100%，高度建议 1000。也可插入 PNG 并附上网页链接。

[Atlassian 官方说明](https://support.atlassian.com/confluence-cloud/docs/insert-the-iframe-macro/)
