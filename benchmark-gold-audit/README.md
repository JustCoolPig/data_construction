# 5条 Benchmark 候选金标审计页面

在本目录上一级 `audit_v2` 启动静态文件服务：

```bash
cd /ifind/user_workspace/xhao/codebase/claude-RL/data/online/tagging/demo/benchmark_gold_audit_20260828/audit_v2
python3 -m http.server 8765
```

浏览器打开：`http://127.0.0.1:8765/site/`

页面包含完整query、5条完整真实轨迹、44张最终CSV、逐单元格证据、独立复取、问题归因与pipeline约束。原始文件未修改。
