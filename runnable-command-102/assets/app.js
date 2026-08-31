(() => {
  "use strict";

  const data = window.BEHAVIOR_DATA;
  if (!data || !Array.isArray(data.records)) {
    document.body.innerHTML = "<main style='padding:40px;font-family:sans-serif'>数据索引加载失败，请确认 data/index.js 与 index.html 位于同一目录结构中。</main>";
    return;
  }

  const records = data.records;
  const modes = data.taxonomy.map((item) => item.label);
  const state = {
    view: "overview",
    selectedModes: new Set(),
    query: "",
    metric: "",
    task: "",
    delivery: "",
    selectedId: null,
    detailTab: "profile",
    traceKind: "all",
    traceQuery: "",
  };
  const tracePromises = new Map();
  const flattenedTraceCache = new Map();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function shortNumber(value) {
    return new Intl.NumberFormat("zh-CN").format(Number(value || 0));
  }

  function queryKindLabel(value) {
    return ({
      scheduled: "调度生成",
      user_query: "用户请求",
      none: "未标记来源",
    })[value] || String(value || "未标记来源");
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function countBy(values) {
    return values.reduce((counts, value) => {
      counts[value] = (counts[value] || 0) + 1;
      return counts;
    }, {});
  }

  function sortedEntries(counts) {
    return Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"));
  }

  function showView(viewName) {
    state.view = viewName;
    $$("[data-view]").forEach((panel) => {
      panel.hidden = panel.dataset.view !== viewName;
    });
    $$("[data-view-target]").forEach((button) => {
      const active = button.dataset.viewTarget === viewName;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    if (viewName === "explorer") {
      renderExplorer();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openMode(mode) {
    state.selectedModes = new Set([mode]);
    state.query = "";
    state.metric = "";
    state.task = "";
    state.delivery = "";
    syncFilterControls();
    showView("explorer");
    const first = filteredRecords()[0];
    if (first) selectRecord(first.id, { scroll: false });
  }

  function openModePair(firstMode, secondMode) {
    state.selectedModes = new Set(firstMode === secondMode ? [firstMode] : [firstMode, secondMode]);
    state.query = "";
    state.metric = "";
    state.task = "";
    state.delivery = "";
    syncFilterControls();
    showView("explorer");
    const first = filteredRecords()[0];
    if (first) selectRecord(first.id, { scroll: false });
  }

  function openRecord(recordId) {
    state.selectedModes.clear();
    state.query = "";
    state.metric = "";
    state.task = "";
    state.delivery = "";
    syncFilterControls();
    showView("explorer");
    selectRecord(recordId, { scroll: true });
  }

  function renderMetrics() {
    const labelHits = records.reduce((sum, record) => sum + record.analysis.behavior_modes.length, 0);
    const traceEntries = records.reduce((sum, record) => sum + Number(record.trajectory.entry_count || 0), 0);
    const rewrittenCount = Number(data.dispatch_summary?.rewritten_count || records.filter((record) => record.rewrite_changed).length);
    const cards = [
      ["COMMANDS", data.total_commands, "完整样本", "01"],
      ["行为标签命中", labelHits, "多标签累计", "02"],
      ["TRAJECTORIES", data.total_trajectories, `${shortNumber(traceEntries)} 条原始记录`, "03"],
      ["QUERY REWRITES", rewrittenCount, "dispatch query 全量更新", "04"],
    ];
    $("#metricStrip").innerHTML = cards.map(([label, value, foot, index]) => `
      <article class="metric-card">
        <div class="metric-label"><span>${escapeHtml(label)}</span><span>${index}</span></div>
        <div class="metric-value">${shortNumber(value)}</div>
        <div class="metric-foot">${escapeHtml(foot)}</div>
      </article>
    `).join("");
    $("#viewMeta").textContent = `${data.total_commands} dispatch queries · ${data.total_trajectories} trajectories · offline`;
  }

  function renderModeChart() {
    const maxCount = Math.max(...Object.values(data.mode_counts));
    $("#modeChart").innerHTML = modes.map((mode, index) => {
      const count = data.mode_counts[mode] || 0;
      const width = (count / maxCount) * 100;
      const definition = data.taxonomy.find((item) => item.label === mode);
      return `
        <button class="mode-row" type="button" data-open-mode="${escapeHtml(mode)}" title="${escapeHtml(definition.description)}">
          <span class="mode-name">${escapeHtml(mode)}</span>
          <span class="mode-track"><span class="mode-fill" style="width:${width.toFixed(1)}%;animation-delay:${index * 45}ms"></span></span>
          <span class="mode-count">${count}</span>
        </button>
      `;
    }).join("");
    $$('[data-open-mode]').forEach((button) => button.addEventListener("click", () => openMode(button.dataset.openMode)));
  }

  function renderTaxonomy() {
    $("#taxonomyList").innerHTML = data.taxonomy.map((item) => `
      <div class="taxonomy-item">
        <strong>${escapeHtml(item.label)}</strong>
        <p>${escapeHtml(item.description)}</p>
      </div>
    `).join("");
  }

  function renderCommandSpine() {
    const maxDensity = Math.max(...records.map((record) => record.analysis.behavior_modes.length));
    $("#commandSpine").innerHTML = records.map((record) => {
      const density = Math.max(1, Math.min(5, Math.ceil((record.analysis.behavior_modes.length / maxDensity) * 5)));
      return `
        <button
          class="spine-cell"
          type="button"
          data-density="${density}"
          data-open-record="${record.id}"
          title="#${String(record.id).padStart(3, "0")} ${escapeHtml(record.description)} · ${record.analysis.behavior_modes.length} 个行为标签"
        >${String(record.id).padStart(3, "0")}</button>
      `;
    }).join("");
    $$('[data-open-record]').forEach((button) => button.addEventListener("click", () => openRecord(Number(button.dataset.openRecord))));
  }

  function pairCount(firstMode, secondMode) {
    return records.filter((record) => record.analysis.behavior_modes.includes(firstMode) && record.analysis.behavior_modes.includes(secondMode)).length;
  }

  function renderCooccurrenceMatrix() {
    const maxCount = Math.max(...modes.flatMap((first) => modes.map((second) => pairCount(first, second))));
    const abbreviations = {
      "纯取数": "纯取数",
      "批量 / 全量取数": "批量",
      "时间区间 / 时序构建": "时序",
      "筛选 / 排序": "筛排",
      "聚合统计": "聚合",
      "衍生计算": "衍生",
      "多源编排 / 校验回退": "多源回退",
      "文件交付": "文件",
    };
    const header = modes.map((mode) => `<th title="${escapeHtml(mode)}">${escapeHtml(abbreviations[mode])}</th>`).join("");
    const body = modes.map((rowMode) => {
      const cells = modes.map((columnMode) => {
        const count = pairCount(rowMode, columnMode);
        const alpha = count ? 0.12 + (count / maxCount) * 0.78 : 0;
        return `<td><button class="matrix-cell ${count ? "" : "is-empty"}" type="button" style="--matrix-alpha:${alpha.toFixed(3)}" data-pair-a="${escapeHtml(rowMode)}" data-pair-b="${escapeHtml(columnMode)}" title="${escapeHtml(rowMode)} × ${escapeHtml(columnMode)}：${count} 条">${count}</button></td>`;
      }).join("");
      return `<tr><th title="${escapeHtml(rowMode)}">${escapeHtml(abbreviations[rowMode])}</th>${cells}</tr>`;
    }).join("");
    $("#cooccurrenceMatrix").innerHTML = `<table class="matrix-table"><thead><tr><th></th>${header}</tr></thead><tbody>${body}</tbody></table>`;
    $$('[data-pair-a]').forEach((button) => button.addEventListener("click", () => openModePair(button.dataset.pairA, button.dataset.pairB)));
  }

  function renderDimensions() {
    const dimensions = [
      ["指标规模", records.map((record) => record.analysis.metric_scope)],
      ["任务面", records.map((record) => record.analysis.task_scope)],
      ["实体范围", records.flatMap((record) => record.analysis.entity_scope)],
      ["时间形态", records.flatMap((record) => record.analysis.temporal_patterns)],
      ["交付形态", records.map((record) => record.analysis.delivery.artifact_scope)],
      ["工具策略", records.map((record) => record.analysis.tool_strategy.mode)],
    ];
    $("#dimensionGrid").innerHTML = dimensions.map(([title, values]) => {
      const stats = sortedEntries(countBy(values)).map(([label, count]) => `
        <div class="dimension-stat"><span>${escapeHtml(label)}</span><strong>${count}</strong></div>
      `).join("");
      return `<section class="dimension-card"><h3>${escapeHtml(title)}</h3>${stats}</section>`;
    }).join("");
  }

  function populateSelect(select, values) {
    const options = sortedEntries(countBy(values));
    select.insertAdjacentHTML("beforeend", options.map(([value, count]) => `<option value="${escapeHtml(value)}">${escapeHtml(value)} · ${count}</option>`).join(""));
  }

  function initFilters() {
    populateSelect($("#metricFilter"), records.map((record) => record.analysis.metric_scope));
    populateSelect($("#taskFilter"), records.map((record) => record.analysis.task_scope));
    populateSelect($("#deliveryFilter"), records.map((record) => record.analysis.delivery.artifact_scope));
    $("#modeFilters").innerHTML = modes.map((mode) => `
      <button class="filter-chip" type="button" data-filter-mode="${escapeHtml(mode)}" aria-pressed="false">
        ${escapeHtml(mode)} <span>${data.mode_counts[mode]}</span>
      </button>
    `).join("");

    $("#commandSearch").addEventListener("input", (event) => {
      state.query = event.target.value;
      renderExplorer();
    });
    $("#metricFilter").addEventListener("change", (event) => {
      state.metric = event.target.value;
      renderExplorer();
    });
    $("#taskFilter").addEventListener("change", (event) => {
      state.task = event.target.value;
      renderExplorer();
    });
    $("#deliveryFilter").addEventListener("change", (event) => {
      state.delivery = event.target.value;
      renderExplorer();
    });
    $("#resetFilters").addEventListener("click", () => {
      state.selectedModes.clear();
      state.query = "";
      state.metric = "";
      state.task = "";
      state.delivery = "";
      syncFilterControls();
      renderExplorer();
    });
    $$('[data-filter-mode]').forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.filterMode;
        if (state.selectedModes.has(mode)) state.selectedModes.delete(mode);
        else state.selectedModes.add(mode);
        renderExplorer();
      });
    });
  }

  function syncFilterControls() {
    $("#commandSearch").value = state.query;
    $("#metricFilter").value = state.metric;
    $("#taskFilter").value = state.task;
    $("#deliveryFilter").value = state.delivery;
    $$('[data-filter-mode]').forEach((button) => {
      const active = state.selectedModes.has(button.dataset.filterMode);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function filteredRecords() {
    const query = state.query.trim().toLocaleLowerCase("zh-CN");
    return records.filter((record) => {
      if (![...state.selectedModes].every((mode) => record.analysis.behavior_modes.includes(mode))) return false;
      if (state.metric && record.analysis.metric_scope !== state.metric) return false;
      if (state.task && record.analysis.task_scope !== state.task) return false;
      if (state.delivery && record.analysis.delivery.artifact_scope !== state.delivery) return false;
      if (!query) return true;
      const haystack = [
        record.id,
        record.description,
        record.command,
        record.command_original,
        record.user_query,
        record.query_kind,
        ...(record.removed_tool_refs || []),
        ...record.analysis.behavior_modes,
        record.analysis.metric_scope,
        record.analysis.task_scope,
        ...record.analysis.entity_scope,
        ...record.analysis.temporal_patterns,
      ].join(" ").toLocaleLowerCase("zh-CN");
      return haystack.includes(query);
    });
  }

  function renderExplorer() {
    syncFilterControls();
    const visible = filteredRecords();
    $("#resultCount").textContent = `${visible.length} 条结果`;
    $("#emptyState").hidden = visible.length !== 0;
    $("#commandList").hidden = visible.length === 0;
    $("#commandList").innerHTML = visible.map((record) => {
      const shownModes = record.analysis.behavior_modes.slice(0, 3);
      const overflow = record.analysis.behavior_modes.length - shownModes.length;
      return `
        <button class="command-item ${state.selectedId === record.id ? "is-selected" : ""}" type="button" data-select-record="${record.id}">
          <span class="command-id">#${String(record.id).padStart(3, "0")}</span>
          <span>
            <strong title="${escapeHtml(record.description)}">${escapeHtml(record.description)}</strong>
            <span class="mini-tags">
              <span class="query-kind-chip">${escapeHtml(queryKindLabel(record.query_kind))}</span>
              ${shownModes.map((mode) => `<span class="mode-chip">${escapeHtml(mode)}</span>`).join("")}
              ${overflow > 0 ? `<span class="tag">+${overflow}</span>` : ""}
            </span>
          </span>
        </button>
      `;
    }).join("");
    $$('[data-select-record]').forEach((button) => button.addEventListener("click", () => selectRecord(Number(button.dataset.selectRecord), { scroll: false })));

    if (state.selectedId && !visible.some((record) => record.id === state.selectedId)) {
      state.selectedId = null;
      renderDetailPlaceholder();
    }
  }

  function renderDetailPlaceholder() {
    $("#detailPanel").innerHTML = `
      <div class="detail-placeholder">
        <span>↳</span>
        <h2>选择一条 Query</h2>
        <p>查看改写后 Query、改写前对照、行为标签，以及按原始顺序整理的完整轨迹。</p>
      </div>
    `;
  }

  function selectRecord(recordId, options = {}) {
    const record = records.find((item) => item.id === Number(recordId));
    if (!record) return;
    state.selectedId = record.id;
    state.detailTab = "profile";
    state.traceKind = "all";
    state.traceQuery = "";
    renderExplorer();
    renderRecordDetail(record);
    if (options.scroll) {
      requestAnimationFrame(() => {
        const selected = $('[data-select-record].is-selected');
        selected?.scrollIntoView({ block: "center" });
      });
    }
  }

  function joinLabels(values) {
    return Array.isArray(values) ? values.join(" · ") : String(values ?? "—");
  }

  function renderRecordDetail(record) {
    const analysis = record.analysis;
    const stats = record.trajectory;
    const removedToolRefs = Array.isArray(record.removed_tool_refs) ? record.removed_tool_refs : [];
    const structures = [
      ["Query 来源", queryKindLabel(record.query_kind)],
      ["改写状态", record.rewrite_changed ? "已改写" : "未变化"],
      ["指标规模", analysis.metric_scope],
      ["任务面", analysis.task_scope],
      ["处理深度", analysis.processing_depth],
      ["实体范围", joinLabels(analysis.entity_scope)],
      ["时间形态", joinLabels(analysis.temporal_patterns)],
      ["交付形态", analysis.delivery.artifact_scope],
      ["输出格式", joinLabels(analysis.delivery.requested_formats)],
      ["工具策略", analysis.tool_strategy.mode],
      ["显式工具", joinLabels(analysis.tool_strategy.explicit_tools) || "未指定"],
      ["移除工具引用", removedToolRefs.length ? joinLabels(removedToolRefs) : "无"],
    ];
    const evidenceCards = analysis.behavior_modes.map((mode) => {
      const evidence = analysis.mode_evidence[mode] || [];
      return `
        <article class="evidence-card">
          <strong>${escapeHtml(mode)}</strong>
          <ul>${evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </article>
      `;
    }).join("");
    $("#detailPanel").innerHTML = `
      <header class="detail-header">
        <div class="detail-topline">
          <div>
            <span class="detail-seq">COMMAND / ${String(record.id).padStart(3, "0")}</span>
            <h2>${escapeHtml(record.description)}</h2>
          </div>
          <div class="detail-stats" aria-label="轨迹记录统计">
            <span>${escapeHtml(queryKindLabel(record.query_kind))}</span>
            <span>${shortNumber(stats.entry_count)} 条轨迹记录</span>
            <span>${shortNumber(stats.tool_call_count)} 次工具调用</span>
            <span>${shortNumber(stats.files_created_count)} 个文件记录</span>
          </div>
        </div>
        <nav class="detail-tabs" aria-label="命令详情视图">
          <button class="detail-tab is-active" type="button" data-detail-tab="profile">改写 Query 与标签</button>
          <button class="detail-tab" type="button" data-detail-tab="trajectory">完整轨迹</button>
          <button class="detail-tab" type="button" data-detail-tab="raw">轨迹 JSON</button>
        </nav>
      </header>
      <div class="detail-body">
        <section class="detail-section" data-detail-section="profile">
          ${record.user_query ? `
            <div class="query-source-block">
              <p class="section-label">USER_QUERY / 上游原始请求</p>
              <pre class="command-text command-text--source">${escapeHtml(record.user_query)}</pre>
            </div>
          ` : ""}
          <div class="rewrite-block">
            <div class="rewrite-heading">
              <p class="section-label">DISPATCH RUNNABLE_COMMAND / 改写后</p>
              <span>标签以此版本计算</span>
            </div>
            <pre class="command-text">${escapeHtml(record.command)}</pre>
          </div>
          <details class="original-query">
            <summary>查看改写前 runnable_command</summary>
            <pre class="command-text command-text--original">${escapeHtml(record.command_original || "未提供改写前文本")}</pre>
          </details>
          <div class="structure-grid">
            ${structures.map(([label, value]) => `<div class="structure-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "未指定")}</strong></div>`).join("")}
          </div>
          <p class="section-label">BEHAVIOR MODES / 命中依据</p>
          <div class="mode-evidence-list">${evidenceCards}</div>
        </section>
        <section class="detail-section" data-detail-section="trajectory" hidden>
          <div class="loading-block">选择“完整轨迹”后按需载入原始记录…</div>
        </section>
        <section class="detail-section" data-detail-section="raw" hidden>
          <div class="loading-block">选择“原始 JSON”后按需载入…</div>
        </section>
      </div>
    `;
    $$('[data-detail-tab]', $("#detailPanel")).forEach((button) => {
      button.addEventListener("click", () => activateDetailTab(record, button.dataset.detailTab));
    });
  }

  function activateDetailTab(record, tab) {
    state.detailTab = tab;
    $$('[data-detail-tab]', $("#detailPanel")).forEach((button) => button.classList.toggle("is-active", button.dataset.detailTab === tab));
    $$('[data-detail-section]', $("#detailPanel")).forEach((section) => {
      section.hidden = section.dataset.detailSection !== tab;
    });
    if (tab === "trajectory" || tab === "raw") {
      loadTrace(record).then((payload) => {
        if (state.selectedId !== record.id || state.detailTab !== tab) return;
        if (tab === "trajectory") renderTrajectory(record, payload);
        else renderRawPayload(payload);
      }).catch((error) => renderTraceLoadError(tab, error));
    }
  }

  function loadTrace(record) {
    const key = String(record.id);
    window.__TRACE_PAYLOADS = window.__TRACE_PAYLOADS || {};
    if (window.__TRACE_PAYLOADS[key]) return Promise.resolve(window.__TRACE_PAYLOADS[key]);
    if (tracePromises.has(key)) return tracePromises.get(key);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = record.trajectory.trace_data_file;
      script.async = true;
      script.onload = () => {
        const payload = window.__TRACE_PAYLOADS[key];
        if (payload) resolve(payload);
        else reject(new Error("轨迹脚本已载入，但未找到对应数据。"));
      };
      script.onerror = () => reject(new Error(`无法载入 ${record.trajectory.trace_data_file}`));
      document.head.appendChild(script);
    });
    tracePromises.set(key, promise);
    return promise;
  }

  function renderTraceLoadError(tab, error) {
    const target = $(`[data-detail-section="${tab}"]`, $("#detailPanel"));
    if (!target) return;
    target.innerHTML = `
      <div class="empty-state">
        <strong>轨迹载入失败</strong>
        <p>${escapeHtml(error.message)}。请确认分享时保留了 data/traces 文件夹。</p>
      </div>
    `;
  }

  function compactPreview(text, limit = 74) {
    const compact = String(text ?? "").replace(/\s+/g, " ").trim();
    return compact.length > limit ? `${compact.slice(0, limit)}…` : compact;
  }

  function stringifyBody(value) {
    if (typeof value === "string") return value;
    if (value === undefined) return "";
    return JSON.stringify(value, null, 2);
  }

  function flattenTrajectory(recordId, payload) {
    if (flattenedTraceCache.has(recordId)) return flattenedTraceCache.get(recordId);
    const trajectory = Array.isArray(payload.trajectory) ? payload.trajectory : [];
    const toolNames = new Map();
    trajectory.forEach((item) => {
      const blocks = Array.isArray(item?.content) ? item.content : [];
      blocks.forEach((block) => {
        if (block && block.id && block.name) toolNames.set(block.id, block.name);
      });
    });
    const steps = [];
    let sequence = 0;
    trajectory.forEach((item, itemIndex) => {
      const blocks = Array.isArray(item?.content) ? item.content : item?.content === undefined ? [] : [item.content];
      if (blocks.length === 0) {
        sequence += 1;
        const body = stringifyBody(item);
        steps.push({ sequence, itemIndex: itemIndex + 1, kind: "record", title: "轨迹记录", body, search: body.toLocaleLowerCase("zh-CN") });
        return;
      }
      blocks.forEach((block, blockIndex) => {
        sequence += 1;
        let kind = "record";
        let title = "轨迹记录";
        let body = "";
        if (typeof block === "string") {
          kind = "model";
          body = block;
          title = `模型文本 · ${compactPreview(body)}`;
        } else if (block && Object.prototype.hasOwnProperty.call(block, "text")) {
          kind = "model";
          body = stringifyBody(block.text);
          title = `模型文本 · ${compactPreview(body)}`;
        } else if (block && block.name && Object.prototype.hasOwnProperty.call(block, "input")) {
          kind = "tool-call";
          body = stringifyBody(block.input);
          title = `工具调用 · ${block.name}`;
        } else if (block && block.tool_use_id) {
          kind = "tool-result";
          body = stringifyBody(block.content);
          const toolName = toolNames.get(block.tool_use_id) || block.tool_use_id;
          title = `工具返回 · ${toolName}${block.is_error ? " · 原始 error 标记" : ""}`;
        } else {
          body = stringifyBody(block);
          title = `轨迹记录 · ${compactPreview(body)}`;
        }
        steps.push({
          sequence,
          itemIndex: itemIndex + 1,
          blockIndex: blockIndex + 1,
          kind,
          title,
          body,
          search: `${title} ${body}`.toLocaleLowerCase("zh-CN"),
        });
      });
    });
    flattenedTraceCache.set(recordId, steps);
    return steps;
  }

  function renderTrajectory(record, payload) {
    const target = $('[data-detail-section="trajectory"]', $("#detailPanel"));
    if (!target) return;
    target.innerHTML = `
      <div class="trace-toolbar">
        <label class="trace-search">
          <input id="traceSearch" type="search" placeholder="在这条轨迹内搜索…" autocomplete="off" value="${escapeHtml(state.traceQuery)}" />
        </label>
        <div class="trace-actions">
          <button type="button" data-trace-action="expand">展开全部</button>
          <button type="button" data-trace-action="collapse">折叠全部</button>
        </div>
        <div class="trace-filters" aria-label="轨迹记录类型">
          ${[
            ["all", "全部"],
            ["model", "模型文本"],
            ["tool-call", "工具调用"],
            ["tool-result", "工具返回"],
            ["record", "其他记录"],
          ].map(([value, label]) => `<button class="trace-filter ${state.traceKind === value ? "is-active" : ""}" type="button" data-trace-kind="${value}">${label}</button>`).join("")}
        </div>
      </div>
      <div class="trace-note"><span>按原始顺序整理，不做成功 / 失败或优 / 劣判断</span><span id="traceVisibleCount"></span></div>
      <div class="trace-stream" id="traceStream"></div>
    `;
    $("#traceSearch", target).addEventListener("input", (event) => {
      state.traceQuery = event.target.value;
      renderTraceStream(record, payload);
    });
    $$('[data-trace-kind]', target).forEach((button) => button.addEventListener("click", () => {
      state.traceKind = button.dataset.traceKind;
      $$('[data-trace-kind]', target).forEach((item) => item.classList.toggle("is-active", item.dataset.traceKind === state.traceKind));
      renderTraceStream(record, payload);
    }));
    $$('[data-trace-action]', target).forEach((button) => button.addEventListener("click", () => {
      const open = button.dataset.traceAction === "expand";
      $$("#traceStream details", target).forEach((detail) => { detail.open = open; });
    }));
    renderTraceStream(record, payload);
  }

  function renderTraceStream(record, payload) {
    const stream = $("#traceStream", $("#detailPanel"));
    if (!stream) return;
    const query = state.traceQuery.trim().toLocaleLowerCase("zh-CN");
    const allSteps = flattenTrajectory(record.id, payload);
    const visible = allSteps.filter((step) => {
      const kindMatches = state.traceKind === "all" || step.kind === state.traceKind;
      const queryMatches = !query || step.search.includes(query);
      return kindMatches && queryMatches;
    });
    $("#traceVisibleCount", $("#detailPanel")).textContent = `${visible.length} / ${allSteps.length} 条`;
    if (!visible.length) {
      stream.innerHTML = `<div class="empty-state"><strong>没有匹配的轨迹记录</strong><p>调整关键词或记录类型。</p></div>`;
      return;
    }
    stream.innerHTML = visible.map((step) => `
      <details class="trace-step" data-kind="${step.kind}" ${step.kind === "model" ? "open" : ""}>
        <summary class="trace-summary">
          <span class="trace-index">${String(step.itemIndex).padStart(3, "0")}.${step.blockIndex || 1}</span>
          <span class="trace-title" title="${escapeHtml(step.title)}">${escapeHtml(step.title)}</span>
          <span class="trace-kind">${escapeHtml(step.kind)}</span>
        </summary>
        <div class="trace-content"><pre class="trace-code">${escapeHtml(step.body)}</pre></div>
      </details>
    `).join("");
  }

  function renderRawPayload(payload) {
    const target = $('[data-detail-section="raw"]', $("#detailPanel"));
    if (!target) return;
    target.innerHTML = `
      <div class="raw-actions">
        <p>完整保留 meta、prompt 与 trajectory；以下内容未经改写。</p>
      </div>
      <pre class="raw-json">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
    `;
  }

  function initNavigation() {
    $$('[data-view-target]').forEach((button) => button.addEventListener("click", () => showView(button.dataset.viewTarget)));
    document.addEventListener("keydown", (event) => {
      const activeTag = document.activeElement?.tagName;
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) {
        event.preventDefault();
        showView("explorer");
        $("#commandSearch").focus();
      }
    });
  }

  function init() {
    renderMetrics();
    renderModeChart();
    renderTaxonomy();
    renderCommandSpine();
    renderCooccurrenceMatrix();
    renderDimensions();
    initFilters();
    initNavigation();
  }

  init();
})();
