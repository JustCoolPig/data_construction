(() => {
  "use strict";

  const data = window.__BENCHMARK_AUDIT__;
  const main = document.querySelector("#main");
  const caseNav = document.querySelector("#caseNav");
  const searchInput = document.querySelector("#globalSearch");
  const sidebar = document.querySelector("#sidebar");
  const navToggle = document.querySelector("#navToggle");
  const drawer = document.querySelector("#evidenceDrawer");
  const drawerBody = document.querySelector("#drawerBody");
  const drawerTitle = document.querySelector("#drawerTitle");
  const drawerBackdrop = document.querySelector("#drawerBackdrop");

  if (!data) {
    main.innerHTML = '<div class="empty-state">审计数据未加载，请确认 data/audit-data.js 存在。</div>';
    return;
  }

  const state = {
    view: "overview",
    caseId: null,
    fileName: null,
    filePage: 1,
    filePageSize: 100,
    fileFilter: "",
    trajectoryFilter: "all",
    trajectorySearch: "",
  };

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const pretty = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  };

  const formatNumber = (value) => Number(value || 0).toLocaleString("zh-CN");
  const isBlocker = (status) => String(status || "").toLowerCase().includes("blocked");
  const severityClass = (value) => String(value || "").toLowerCase().includes("block") ? "blocker" : "high";
  const verdictClass = (value) => value === "通过" ? "pass" : "blocker";

  function caseById(id) {
    return data.cases.find((item) => item.case === Number(id));
  }

  function renderSidebar() {
    caseNav.innerHTML = data.cases.map((caseData) => `
      <div class="case-nav">
        <button class="nav-item case-nav-button ${state.caseId === caseData.case ? "is-active" : ""}" data-case="${caseData.case}" type="button">
          <span>案例 ${caseData.case}</span><small>${caseData.stats.blockedFiles}/${caseData.stats.fileCount} 阻断</small>
        </button>
        <div class="case-nav-head">最终 CSV</div>
        ${caseData.files.map((file) => `
          <button class="nav-item file-nav ${state.caseId === caseData.case && state.fileName === file.name ? "is-active" : ""}" data-case="${caseData.case}" data-file="${esc(file.name)}" type="button" title="${esc(file.name)}">
            <span class="verdict-dot ${verdictClass(file.verdict)}"></span>
            <span>${esc(file.name)}</span>
          </button>
        `).join("")}
      </div>
    `).join("");
    document.querySelector(".nav-overview")?.classList.toggle("is-active", state.view === "overview");
  }

  function navigate(view, caseId = null, fileName = null, replace = false) {
    state.view = view;
    state.caseId = caseId ? Number(caseId) : null;
    state.fileName = fileName || null;
    state.filePage = 1;
    state.fileFilter = "";
    state.trajectoryFilter = "all";
    state.trajectorySearch = "";
    searchInput.value = "";
    const hash = view === "overview" ? "#overview" : `#case-${state.caseId}${fileName ? `/file=${encodeURIComponent(fileName)}` : ""}`;
    if (replace) history.replaceState(null, "", hash); else history.pushState(null, "", hash);
    render();
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
    closeMobileNav();
  }

  function restoreFromHash() {
    const hash = location.hash || "#overview";
    const match = hash.match(/^#case-(\d+)(?:\/file=(.+))?$/);
    if (match && caseById(match[1])) {
      state.view = "case";
      state.caseId = Number(match[1]);
      state.fileName = match[2] ? decodeURIComponent(match[2]) : null;
    } else {
      state.view = "overview";
      state.caseId = null;
      state.fileName = null;
    }
    render();
  }

  function metric(value, label, cls = "") {
    return `<div class="metric ${cls}"><strong>${formatNumber(value)}</strong><span>${esc(label)}</span></div>`;
  }

  function renderOverview() {
    const o = data.overview;
    main.innerHTML = `
      <div class="content-wrap">
        <section class="verdict-hero">
          <p class="eyebrow">最终交叉复核结论</p>
          <h1><span class="verdict-word">0 / 5</span> 条可进入 benchmark</h1>
          <p class="lede">${esc(data.acceptanceDecision)}</p>
        </section>

        <div class="metric-grid">
          ${metric(o.declared_final_csv_files, "声明的最终 CSV")}
          ${metric(o.blocked_csv_files, "文件阻断", "block")}
          ${metric(o.passed_csv_files, "单表通过", "pass")}
          ${metric(o.documented_data_cells, "逐格审计的数据单元格")}
          ${metric(o.case_level_blocker_findings, "案例级阻断问题", "block")}
          ${metric(o.case_level_high_findings, "高风险问题")}
          ${metric(o.files_created_recorded_final_files, "files_created 实际记录")}
          ${metric(o.files_created_missing_final_files, "元数据漏记的最终表", "block")}
        </div>

        <details class="audit-note">
          <summary>审计口径（全站只在这里说明一次）</summary>
          <p>${esc(data.auditPrinciple)} 所有“通过/阻断”均为人工复核后的文件级结论，不使用置信度、证据强度或自动诊断等级替代事实。</p>
        </details>

        <section class="section">
          <div class="section-head"><h2>5 条候选案例</h2><p>点击进入完整 query、轨迹、CSV 与证据</p></div>
          <div class="case-grid">
            ${data.cases.map((caseData) => `
              <article class="case-card" data-open-case="${caseData.case}" tabindex="0" role="button">
                <span class="case-no">CASE ${String(caseData.case).padStart(2, "0")}</span>
                <h3>${esc(caseData.title.replace(/^案例 \d+ · /, ""))}</h3>
                <div class="case-stats">
                  <span><b>${caseData.stats.blockedFiles}</b>阻断文件</span>
                  <span><b>${formatNumber(caseData.stats.cells)}</b>单元格</span>
                  <span><b>${caseData.stats.events}</b>轨迹事件</span>
                  <span><b>${caseData.stats.toolCalls}</b>工具调用</span>
                </div>
              </article>
            `).join("")}
          </div>
        </section>

        <section class="section">
          <div class="section-head"><h2>必须先解决的根因</h2><p>按主 pipeline 阶段归并，不按表面症状堆规则</p></div>
          <div class="root-list">
            ${data.rootCauseFamilies.map((item) => `
              <article class="root-row">
                <span class="priority">${esc(item.priority)}</span>
                <strong>${esc(item.family)}</strong>
                <p>${item.examples.map(esc).join(" · ")}</p>
                <small>${esc(item.pipeline_stage)}</small>
              </article>
            `).join("")}
          </div>
        </section>

        <section class="section">
          <div class="section-head"><h2>交叉复核已确认</h2><p>独立于单案例结论再次验证</p></div>
          <ul class="check-list">${data.crossChecks.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
        </section>

        <section class="section">
          <div class="section-head"><h2>后续主 pipeline 约束</h2><p>review 只拒绝或放行，不负责修金标</p></div>
          <div class="pipeline-grid">
            ${data.pipelineSections.map((section) => `
              <article class="pipeline-card">
                <h3>${esc(section.title)}</h3>
                ${section.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}
                ${section.items.length ? `<ol>${section.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>` : ""}
              </article>
            `).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function queryAuditHtml(items) {
    if (!items?.length) return '<div class="empty-state">没有单独的 query 审计条目。</div>';
    return `<div class="query-audit-list">${items.map((item) => {
      const clause = item.clause || item.fragment || item.query_text || item.item || item.title || Object.values(item)[0];
      const verdict = item.verdict || item.status || item.judgement || "已核验";
      const reason = item.reason || item.issue || item.explanation || item.note || pretty(item);
      return `<article class="query-audit-item"><strong>${esc(clause)} · ${esc(verdict)}</strong><p>${esc(reason)}</p></article>`;
    }).join("")}</div>`;
  }

  function chainHit(layer, node) {
    const text = String(layer || "").toLowerCase();
    const maps = {
      query: ["query", "任务", "构造"],
      trace: ["模型", "轨迹", "终答"],
      tool: ["工具", "数据", "source", "口径"],
      csv: ["csv", "生成", "范围", "产物", "保留", "元数据"],
      verifier: ["verifier", "judge", "评分"],
    };
    return maps[node].some((token) => text.includes(token));
  }

  function renderFindings(findings) {
    const sorted = [...findings].sort((a, b) => severityClass(a.severity) === "blocker" ? -1 : 1);
    return `<div class="finding-list">${sorted.map((finding) => {
      const severity = severityClass(finding.severity);
      const layer = finding.layer || finding.root_cause_layer || finding.attribution || "未标注层";
      const title = finding.title || finding.problem || finding.issue || finding.id;
      const evidence = Array.isArray(finding.evidence) ? finding.evidence : [finding.evidence].filter(Boolean);
      const impact = finding.impact || finding.why_blocking || finding.consequence || "—";
      const root = finding.root_cause || finding.cause || "—";
      const constraint = finding.pipeline_constraint || finding.recommendation || finding.fix || "—";
      return `
        <article class="finding-card" id="finding-${esc(finding.id || "")}">
          <div class="finding-rail">
            <div class="evidence-chain" aria-label="主要归因层">
              ${[["query", "Query"], ["trace", "轨迹"], ["tool", "工具/数据"], ["csv", "CSV/产物"], ["verifier", "Verifier"]].map(([key, label]) => `<span class="chain-node ${chainHit(layer, key) ? "is-hit" : ""}">${label}</span>`).join("")}
            </div>
          </div>
          <div class="finding-body">
            <div class="finding-meta">
              <span class="badge ${severity}">${severity === "blocker" ? "阻断" : "高风险"}</span>
              <span class="badge info">${esc(layer)}</span>
              ${finding.id ? `<span class="badge">${esc(finding.id)}</span>` : ""}
            </div>
            <h3>${esc(title)}</h3>
            ${evidence.length ? `<ul class="finding-evidence">${evidence.map((item) => `<li>${esc(pretty(item))}</li>`).join("")}</ul>` : ""}
            <div class="finding-detail-grid">
              <div><small>影响</small>${esc(pretty(impact))}</div>
              <div><small>根因</small>${esc(pretty(root))}</div>
              <div style="grid-column:1/-1"><small>主 pipeline 约束</small>${esc(pretty(constraint))}</div>
            </div>
          </div>
        </article>`;
    }).join("")}</div>`;
  }

  function fileMeta(file) {
    const m = file.metadata || {};
    const declared = m.declared_key?.columns || m.declared_key || m.key || "—";
    const semantic = m.semantic_key?.columns || m.semantic_key || "—";
    const unique = m.declared_key?.is_unique;
    return `
      <div class="file-meta-grid">
        <div><small>行 × 列</small><b>${formatNumber(file.rows.length)} × ${file.headers.length}</b></div>
        <div><small>声明主键</small><b>${esc(Array.isArray(declared) ? declared.join(" + ") : declared)}</b></div>
        <div><small>合理主键</small><b>${esc(Array.isArray(semantic) ? semantic.join(" + ") : semantic)}</b></div>
        <div><small>声明键当前唯一</small><b>${unique === undefined ? "见审计" : unique ? "是" : "否"}</b></div>
        <div><small>空单元格</small><b>${formatNumber(m.blank_cell_count || 0)}</b></div>
        <div><small>SHA256</small><b title="${esc(m.sha256 || "")}">${esc((m.sha256 || "—").slice(0, 12))}</b></div>
      </div>`;
  }

  function fileListHtml(caseData) {
    return `<div class="file-list">${caseData.files.map((file) => `
      <button class="file-card ${state.fileName === file.name ? "is-active" : ""}" data-select-file="${esc(file.name)}" type="button">
        <strong>${esc(file.name)}</strong>
        <small><span class="verdict-dot ${verdictClass(file.verdict)}"></span> ${file.verdict} · ${formatNumber(file.rows.length)} 行</small>
      </button>
    `).join("")}</div>`;
  }

  function selectedFile(caseData) {
    return caseData.files.find((file) => file.name === state.fileName) || caseData.files[0];
  }

  function renderFileViewer(caseData) {
    const target = document.querySelector("#fileViewer");
    if (!target) return;
    const file = selectedFile(caseData);
    state.fileName = file.name;
    const filter = state.fileFilter.trim().toLowerCase();
    const indexedRows = file.rows.map((row, index) => ({ row, index }));
    const filtered = filter ? indexedRows.filter(({ row }) => row.some((value) => String(value).toLowerCase().includes(filter))) : indexedRows;
    const pages = Math.max(1, Math.ceil(filtered.length / state.filePageSize));
    state.filePage = Math.min(Math.max(1, state.filePage), pages);
    const start = (state.filePage - 1) * state.filePageSize;
    const pageRows = filtered.slice(start, start + state.filePageSize);

    target.innerHTML = `
      <div class="file-viewer-head">
        <div class="file-title-line"><h3>${esc(file.name)}</h3><span class="pill ${verdictClass(file.verdict)}">${file.verdict}</span></div>
        <p class="file-reason">${esc(file.reason)}</p>
        ${fileMeta(file)}
      </div>
      <div class="table-tools">
        <input id="fileFilter" type="search" value="${esc(state.fileFilter)}" placeholder="在这张 CSV 中筛选行">
        <select id="filePageSize" aria-label="每页行数">
          ${[50, 100, 500].map((size) => `<option value="${size}" ${state.filePageSize === size ? "selected" : ""}>每页 ${size}</option>`).join("")}
        </select>
        <span class="row-count">显示 ${formatNumber(filtered.length)} / ${formatNumber(file.rows.length)} 行 · 点击任意单元格看证据</span>
      </div>
      <div class="table-wrap">
        <table class="csv-table">
          <thead><tr><th class="row-number">行</th>${file.headers.map((header) => `<th title="${esc(header)}">${esc(header)}</th>`).join("")}</tr></thead>
          <tbody>${pageRows.map(({ row, index }) => `
            <tr><td class="row-number">${index + 2}</td>${row.map((value, columnIndex) => {
              const flat = index * file.headers.length + columnIndex;
              const template = file.evidence.templates[file.evidence.templateIds[flat]] || {};
              const cls = isBlocker(template.status) ? "cell-blocked" : "cell-verified";
              return `<td class="cell-evidence ${cls}" data-cell-row="${index}" data-cell-col="${columnIndex}" title="${esc(value)}">${esc(value || "∅")}</td>`;
            }).join("")}</tr>
          `).join("")}</tbody>
        </table>
      </div>
      <div class="pagination">
        <button type="button" data-page="${state.filePage - 1}" ${state.filePage <= 1 ? "disabled" : ""}>‹</button>
        <span>第 ${state.filePage} / ${pages} 页</span>
        <button type="button" data-page="${state.filePage + 1}" ${state.filePage >= pages ? "disabled" : ""}>›</button>
      </div>`;
    renderSidebar();
  }

  function classifyEvent(event, index, total) {
    if (event.subtype === "init") return "system";
    if (event.subtype === "success") return "final";
    const blocks = Array.isArray(event.content) ? event.content : [];
    if (event.error || blocks.some((block) => block?.is_error)) return "error";
    if (blocks.some((block) => block && "id" in block && "name" in block)) return "call";
    if (blocks.some((block) => block && "tool_use_id" in block)) return "result";
    if (blocks.some((block) => block && "thinking" in block)) return "thinking";
    if (blocks.some((block) => block && "text" in block)) return index >= total - 3 ? "final" : "text";
    return "system";
  }

  function eventTitle(event, type) {
    const blocks = Array.isArray(event.content) ? event.content : [];
    if (type === "call") {
      const block = blocks.find((item) => item && item.name);
      return `${block.name} · ${block.id}`;
    }
    if (type === "result" || type === "error") {
      const block = blocks.find((item) => item && item.tool_use_id);
      return `${block?.is_error ? "工具错误" : "工具结果"} · ${block?.tool_use_id || ""}`;
    }
    if (type === "thinking") return String(blocks.find((item) => item?.thinking)?.thinking || "").replace(/\s+/g, " ").slice(0, 150);
    if (type === "text" || type === "final") return String(blocks.find((item) => item?.text)?.text || event.result || "").replace(/\s+/g, " ").slice(0, 150);
    return event.subtype || "系统事件";
  }

  function eventBlocks(event) {
    const blocks = Array.isArray(event.content) ? event.content : [];
    const parts = blocks.map((block) => {
      if (block?.thinking !== undefined) return `<div class="event-block"><div class="event-block-head"><span>思考</span></div><div class="event-content">${esc(block.thinking)}</div></div>`;
      if (block?.text !== undefined) return `<div class="event-block"><div class="event-block-head"><span>文本</span></div><div class="event-content">${esc(block.text)}</div></div>`;
      if (block?.id && block?.name) return `<div class="event-block"><div class="event-block-head"><span>工具调用 ${esc(block.name)}</span><span>tool_use_id=${esc(block.id)}</span></div><div class="event-content">${esc(pretty(block.input))}</div></div>`;
      if (block?.tool_use_id) return `<div class="event-block"><div class="event-block-head"><span>${block.is_error ? "工具错误" : "工具结果"}</span><span>tool_use_id=${esc(block.tool_use_id)}</span></div><div class="event-content">${esc(pretty(block.content))}</div></div>`;
      return `<div class="event-block"><div class="event-block-head"><span>内容块</span></div><div class="event-content">${esc(pretty(block))}</div></div>`;
    });
    const metadata = Object.fromEntries(Object.entries(event).filter(([key]) => key !== "content"));
    if (Object.keys(metadata).length) parts.push(`<details class="event-block"><summary>事件元数据</summary><div class="event-content">${esc(pretty(metadata))}</div></details>`);
    return parts.join("");
  }

  function trajectoryHtml(caseData) {
    const q = state.trajectorySearch.trim().toLowerCase();
    const events = caseData.trajectory.map((event, index) => ({ event, index, type: classifyEvent(event, index, caseData.trajectory.length) }))
      .filter(({ event, type }) => (state.trajectoryFilter === "all" || type === state.trajectoryFilter) && (!q || JSON.stringify(event).toLowerCase().includes(q)));
    return `
      <div class="trajectory-tools">
        ${[["all", "全部"], ["thinking", "思考"], ["call", "工具调用"], ["result", "工具结果"], ["error", "错误"], ["final", "终答/完成"]].map(([value, label]) => `<button class="filter-button ${state.trajectoryFilter === value ? "is-active" : ""}" type="button" data-trace-filter="${value}">${label}</button>`).join("")}
        <input id="trajectorySearch" class="trajectory-search" type="search" value="${esc(state.trajectorySearch)}" placeholder="在完整轨迹内搜索">
      </div>
      <div class="trajectory-list">
        ${events.length ? events.map(({ event, index, type }) => `
          <details class="event" data-event-index="${index}">
            <summary><span class="event-index">#${String(index).padStart(3, "0")}</span><span class="event-type ${type}">${type}</span><span class="event-title">${esc(eventTitle(event, type))}</span></summary>
            <div class="event-blocks">${eventBlocks(event)}</div>
          </details>
        `).join("") : '<div class="empty-state">当前筛选没有轨迹事件。</div>'}
      </div>`;
  }

  function renderCase() {
    const caseData = caseById(state.caseId);
    if (!caseData) return renderOverview();
    if (!state.fileName || !caseData.files.some((file) => file.name === state.fileName)) state.fileName = caseData.files[0].name;
    main.innerHTML = `
      <div class="content-wrap">
        <header class="case-header">
          <div><p class="eyebrow">TRACE ${esc(caseData.traceId)}</p><h1>${esc(caseData.title)}</h1><p class="lede">完整 query、真实轨迹、最终 CSV、独立复取与逐单元格证据均可下钻。</p></div>
          <div class="qualification-box"><small>当前金标资格</small><strong>${esc(caseData.qualification)}</strong></div>
        </header>
        <div class="mini-metrics">
          <span class="mini-metric"><b>${caseData.stats.fileCount}</b><span>最终CSV</span></span>
          <span class="mini-metric"><b>${caseData.stats.blockedFiles}</b><span>阻断</span></span>
          <span class="mini-metric"><b>${formatNumber(caseData.stats.cells)}</b><span>逐格审计</span></span>
          <span class="mini-metric"><b>${caseData.stats.events}</b><span>轨迹事件</span></span>
          <span class="mini-metric"><b>${caseData.stats.toolCalls}</b><span>工具调用/result严格配对</span></span>
        </div>

        <section class="section">
          <details class="fold" open>
            <summary><strong>原始 query 与逐句审计</strong><span class="pill info">完整文本</span></summary>
            <div class="fold-content"><pre class="query-text">${esc(caseData.query)}</pre>${queryAuditHtml(caseData.queryAudit)}</div>
          </details>
        </section>

        <section class="section">
          <div class="section-head"><h2>阻断问题与归因</h2><p>主要归因层在左侧证据链中标红</p></div>
          ${renderFindings(caseData.findings)}
        </section>

        <section class="section" id="csvSection">
          <div class="section-head"><h2>${caseData.stats.fileCount} 张最终 CSV</h2><p>点击文件，再点击单元格查看来源与独立值</p></div>
          ${fileListHtml(caseData)}
          <div id="fileViewer" class="file-viewer"></div>
        </section>

        <section class="section" id="trajectorySection">
          <details class="fold">
            <summary><strong>完整真实轨迹（${caseData.stats.events} events）</strong><span class="pill info">thinking / call / result / error / final</span></summary>
            <div class="fold-content" id="trajectoryViewer">${trajectoryHtml(caseData)}</div>
          </details>
        </section>

        <section class="section">
          <details class="fold">
            <summary><strong>独立复取与交叉证据</strong><span class="pill info">真实工具复跑</span></summary>
            <div class="fold-content"><pre class="raw-json">${esc(pretty(caseData.independentEvidence))}</pre></div>
          </details>
          <details class="fold">
            <summary><strong>原始完整性与产物保留</strong><span class="pill ${caseData.retention.missing_final_names.length ? "blocker" : "pass"}">${caseData.retention.recorded_final_files}/${caseData.retention.declared_final_files} 最终表被记录</span></summary>
            <div class="fold-content"><pre class="raw-json">${esc(pretty({ sourceIntegrity: caseData.sourceIntegrity, retention: caseData.retention, cellCoverage: caseData.cellCoverage }))}</pre></div>
          </details>
          <details class="fold">
            <summary><strong>轨迹人工审计摘要</strong><span class="pill info">完整逐步阅读</span></summary>
            <div class="fold-content"><pre class="raw-json">${esc(pretty(caseData.traceReview))}</pre></div>
          </details>
        </section>
      </div>`;
    renderFileViewer(caseData);
  }

  function renderSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) return render();
    const results = [];
    for (const caseData of data.cases) {
      if (`${caseData.title}\n${caseData.query}`.toLowerCase().includes(q)) results.push({ caseId: caseData.case, scope: "Query", title: caseData.title, text: caseData.query.slice(0, 240) });
      for (const finding of caseData.findings) {
        const text = JSON.stringify(finding);
        if (text.toLowerCase().includes(q)) results.push({ caseId: caseData.case, scope: "问题", title: finding.title || finding.problem || finding.id, text: (finding.impact || text).slice(0, 260) });
      }
      for (const file of caseData.files) {
        if (`${file.name} ${file.reason}`.toLowerCase().includes(q)) results.push({ caseId: caseData.case, file: file.name, scope: "CSV", title: file.name, text: file.reason });
      }
      let traceMatches = 0;
      caseData.trajectory.forEach((event, index) => {
        if (traceMatches >= 3) return;
        const text = JSON.stringify(event);
        if (text.toLowerCase().includes(q)) {
          results.push({ caseId: caseData.case, scope: `轨迹 #${index}`, title: eventTitle(event, classifyEvent(event, index, caseData.trajectory.length)), text: text.slice(0, 260), eventIndex: index });
          traceMatches += 1;
        }
      });
    }
    main.innerHTML = `<div class="content-wrap"><p class="eyebrow">全站搜索</p><h1>“${esc(query)}”</h1><p class="lede">找到 ${results.length} 个结果；每条轨迹最多展示3个命中，进入案例后可继续精确搜索。</p><section class="section"><div class="search-results">${results.length ? results.slice(0, 100).map((item) => `<article class="search-result" data-search-case="${item.caseId}" ${item.file ? `data-search-file="${esc(item.file)}"` : ""} ${item.eventIndex !== undefined ? `data-search-event="${item.eventIndex}"` : ""} tabindex="0" role="button"><small>案例 ${item.caseId} · ${esc(item.scope)}</small><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></article>`).join("") : '<div class="empty-state">没有匹配内容。</div>'}</div></section></div>`;
  }

  function openEvidence(caseData, file, rowIndex, columnIndex) {
    const flat = rowIndex * file.headers.length + columnIndex;
    const template = file.evidence.templates[file.evidence.templateIds[flat]] || {};
    const independent = file.evidence.independentValues[String(flat)];
    drawerTitle.textContent = `${file.name} · 行 ${rowIndex + 2}`;
    drawerBody.innerHTML = `
      <span class="badge ${isBlocker(template.status) ? "blocker" : "pass"}">${isBlocker(template.status) ? "阻断单元格" : "已核验单元格"}</span>
      <div class="evidence-field"><label>列</label><p class="mono">${esc(file.headers[columnIndex])}</p></div>
      <div class="evidence-field"><label>原始值</label><div class="evidence-value">${esc(file.rows[rowIndex][columnIndex] || "∅")}</div></div>
      ${independent !== undefined ? `<div class="evidence-field"><label>独立复取 / 复算值</label><div class="evidence-value">${esc(independent)}</div></div>` : ""}
      <div class="evidence-field"><label>状态</label><p class="mono">${esc(template.status || "—")}</p></div>
      <div class="evidence-field"><label>真实来源</label><pre>${esc(pretty(template.source))}</pre></div>
      <div class="evidence-field"><label>转换</label><p>${esc(pretty(template.transform))}</p></div>
      <div class="evidence-field"><label>核验结论</label><p>${esc(pretty(template.note))}</p></div>
      <div class="evidence-field"><label>金标资格</label><p>${esc(pretty(template.qualification))}</p></div>`;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    drawerBackdrop.hidden = false;
  }

  function closeEvidence() {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    drawerBackdrop.hidden = true;
  }

  function render() {
    renderSidebar();
    if (state.view === "case") renderCase(); else renderOverview();
    document.querySelector("#globalStatus").textContent = `${formatNumber(data.overview.documented_data_cells)} 单元格 · 5 条完整轨迹${data.redactions ? ` · ${data.redactions} 处凭据脱敏` : ""}`;
  }

  function closeMobileNav() {
    sidebar.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }

  let searchTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderSearch(searchInput.value), 180);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === "Escape") {
      closeEvidence();
      closeMobileNav();
    }
  });

  document.querySelector("#homeButton").addEventListener("click", () => navigate("overview"));
  document.querySelector(".nav-overview").addEventListener("click", () => navigate("overview"));
  navToggle.addEventListener("click", () => {
    const open = sidebar.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  document.querySelector("#drawerClose").addEventListener("click", closeEvidence);
  drawerBackdrop.addEventListener("click", closeEvidence);
  window.addEventListener("hashchange", restoreFromHash);

  document.addEventListener("click", (event) => {
    const caseButton = event.target.closest("[data-case]:not([data-file])");
    if (caseButton) return navigate("case", caseButton.dataset.case);
    const navFile = event.target.closest("[data-case][data-file]");
    if (navFile) return navigate("case", navFile.dataset.case, navFile.dataset.file);
    const openCase = event.target.closest("[data-open-case]");
    if (openCase) return navigate("case", openCase.dataset.openCase);
    const selectFile = event.target.closest("[data-select-file]");
    if (selectFile && state.caseId) {
      state.fileName = selectFile.dataset.selectFile;
      state.filePage = 1;
      state.fileFilter = "";
      history.replaceState(null, "", `#case-${state.caseId}/file=${encodeURIComponent(state.fileName)}`);
      document.querySelectorAll("[data-select-file]").forEach((node) => node.classList.toggle("is-active", node.dataset.selectFile === state.fileName));
      renderFileViewer(caseById(state.caseId));
      return;
    }
    const pageButton = event.target.closest("[data-page]");
    if (pageButton && !pageButton.disabled) {
      state.filePage = Number(pageButton.dataset.page);
      renderFileViewer(caseById(state.caseId));
      return;
    }
    const cellNode = event.target.closest("[data-cell-row][data-cell-col]");
    if (cellNode && state.caseId) {
      const caseData = caseById(state.caseId);
      openEvidence(caseData, selectedFile(caseData), Number(cellNode.dataset.cellRow), Number(cellNode.dataset.cellCol));
      return;
    }
    const traceFilter = event.target.closest("[data-trace-filter]");
    if (traceFilter && state.caseId) {
      state.trajectoryFilter = traceFilter.dataset.traceFilter;
      document.querySelector("#trajectoryViewer").innerHTML = trajectoryHtml(caseById(state.caseId));
      return;
    }
    const searchResult = event.target.closest("[data-search-case]");
    if (searchResult) {
      navigate("case", searchResult.dataset.searchCase, searchResult.dataset.searchFile || null);
      if (searchResult.dataset.searchEvent !== undefined) {
        setTimeout(() => {
          const fold = document.querySelector("#trajectorySection .fold");
          if (fold) fold.open = true;
          const target = document.querySelector(`[data-event-index="${searchResult.dataset.searchEvent}"]`);
          if (target) { target.open = true; target.scrollIntoView({ block: "center" }); }
        }, 50);
      }
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "fileFilter") {
      state.fileFilter = event.target.value;
      state.filePage = 1;
      const position = event.target.selectionStart;
      renderFileViewer(caseById(state.caseId));
      const input = document.querySelector("#fileFilter");
      input.focus();
      input.setSelectionRange(position, position);
    }
    if (event.target.id === "trajectorySearch") {
      state.trajectorySearch = event.target.value;
      const position = event.target.selectionStart;
      document.querySelector("#trajectoryViewer").innerHTML = trajectoryHtml(caseById(state.caseId));
      const input = document.querySelector("#trajectorySearch");
      input.focus();
      input.setSelectionRange(position, position);
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "filePageSize") {
      state.filePageSize = Number(event.target.value);
      state.filePage = 1;
      renderFileViewer(caseById(state.caseId));
    }
  });

  document.addEventListener("keydown", (event) => {
    const actionable = event.target.closest("[data-open-case], [data-search-case]");
    if (actionable && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      actionable.click();
    }
  });

  restoreFromHash();
})();
