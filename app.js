const storageKey = "zfl16-movable-type-workshop";

const starterInventory = [
  { id: crypto.randomUUID(), char: "山", style: "宋体旧字", size: 30, quantity: 4, wear: "微磨" },
  { id: crypto.randomUUID(), char: "月", style: "宋体旧字", size: 30, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "风", style: "楷体木刻", size: 28, quantity: 2, wear: "微磨" },
  { id: crypto.randomUUID(), char: "花", style: "楷体木刻", size: 28, quantity: 2, wear: "新" },
  { id: crypto.randomUUID(), char: "茶", style: "黑体铅字", size: 24, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "雨", style: "仿宋细字", size: 22, quantity: 4, wear: "新" }
];

const defaultState = {
  inventory: starterInventory,
  selectedTypeId: starterInventory[0].id,
  placements: [],
  drafts: [],
  settings: {
    paperSize: "postcard",
    flowMode: "horizontal",
    gridGap: 8,
    workTitle: "晚风小笺"
  },
  // 校字台：原稿、校样、对读结果与裁决、历次校记
  proof: {
    origText: "",
    revText: "",
    ignoreSpace: true,
    startRow: 0,
    startCol: 0,
    pairs: [],
    filter: "all",
    note: "",
    applied: false,
    stale: false // 原稿/校样/忽略空白改动后，旧对读结果失效
  },
  proofRecords: [],
  ui: { view: "typeset" }
};

let state = loadState();

const els = {
  paperSize: document.querySelector("#paperSize"),
  flowMode: document.querySelector("#flowMode"),
  gridGap: document.querySelector("#gridGap"),
  workTitle: document.querySelector("#workTitle"),
  stage: document.querySelector("#stage"),
  typeList: document.querySelector("#typeList"),
  typeForm: document.querySelector("#typeForm"),
  charInput: document.querySelector("#charInput"),
  styleInput: document.querySelector("#styleInput"),
  sizeInput: document.querySelector("#sizeInput"),
  quantityInput: document.querySelector("#quantityInput"),
  wearInput: document.querySelector("#wearInput"),
  inventorySearch: document.querySelector("#inventorySearch"),
  styleFilter: document.querySelector("#styleFilter"),
  selectedTypeLabel: document.querySelector("#selectedTypeLabel"),
  shortageBadge: document.querySelector("#shortageBadge"),
  usageList: document.querySelector("#usageList"),
  draftList: document.querySelector("#draftList"),
  placedCount: document.querySelector("#placedCount"),
  inventoryCount: document.querySelector("#inventoryCount"),
  saveDraftBtn: document.querySelector("#saveDraftBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  clearBoardBtn: document.querySelector("#clearBoardBtn"),
  // 校字台
  typesetView: document.querySelector("#typesetView"),
  proofView: document.querySelector("#proofView"),
  origText: document.querySelector("#origText"),
  revText: document.querySelector("#revText"),
  origCount: document.querySelector("#origCount"),
  revCount: document.querySelector("#revCount"),
  ignoreSpace: document.querySelector("#ignoreSpace"),
  startLabel: document.querySelector("#startLabel"),
  pickStartBtn: document.querySelector("#pickStartBtn"),
  compareBtn: document.querySelector("#compareBtn"),
  resetProofBtn: document.querySelector("#resetProofBtn"),
  compareHint: document.querySelector("#compareHint"),
  diffSummary: document.querySelector("#diffSummary"),
  diffFilter: document.querySelector("#diffFilter"),
  pairList: document.querySelector("#pairList"),
  preflightList: document.querySelector("#preflightList"),
  preflightBtn: document.querySelector("#preflightBtn"),
  proofStage: document.querySelector("#proofStage"),
  proofBoardHint: document.querySelector("#proofBoardHint"),
  batchProofBtn: document.querySelector("#batchProofBtn"),
  batchOrigBtn: document.querySelector("#batchOrigBtn"),
  proofNote: document.querySelector("#proofNote"),
  applyProofBtn: document.querySelector("#applyProofBtn"),
  recordList: document.querySelector("#recordList"),
  proofStatusLine: document.querySelector("#proofStatusLine")
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: { ...defaultState.settings, ...parsed.settings },
      proof: { ...structuredClone(defaultState).proof, ...(parsed.proof || {}) }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function getGrid() {
  const size = state.settings.paperSize;
  if (size === "bookmark") return { cols: 7, rows: 18 };
  if (size === "square") return { cols: 12, rows: 12 };
  return { cols: 16, rows: 10 };
}

function placementKey(row, col) {
  return `${row}:${col}`;
}

function getSelectedType() {
  return state.inventory.find((item) => item.id === state.selectedTypeId) || null;
}

function getUsage() {
  return state.placements.reduce((acc, placement) => {
    acc[placement.typeId] = (acc[placement.typeId] || 0) + 1;
    return acc;
  }, {});
}

function renderSettings() {
  els.paperSize.value = state.settings.paperSize;
  els.flowMode.value = state.settings.flowMode;
  els.gridGap.value = state.settings.gridGap;
  els.workTitle.value = state.settings.workTitle;
}

function renderStyleFilter() {
  const current = els.styleFilter.value || "all";
  const styles = [...new Set(state.inventory.map((item) => item.style))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  els.styleFilter.innerHTML = `<option value="all">全部风格</option>${styles
    .map((style) => `<option value="${escapeHtml(style)}">${escapeHtml(style)}</option>`)
    .join("")}`;
  els.styleFilter.value = styles.includes(current) ? current : "all";
}

function renderInventory() {
  const keyword = els.inventorySearch.value.trim();
  const style = els.styleFilter.value;
  const usage = getUsage();
  const items = state.inventory.filter((item) => {
    const matchesKeyword = !keyword || `${item.char}${item.style}${item.wear}`.includes(keyword);
    const matchesStyle = style === "all" || item.style === style;
    return matchesKeyword && matchesStyle;
  });

  els.inventoryCount.textContent = `${state.inventory.length}枚字模`;
  els.typeList.innerHTML = items
    .map((item) => {
      const used = usage[item.id] || 0;
      const selected = item.id === state.selectedTypeId ? "selected" : "";
      return `
        <article class="type-card ${selected}" draggable="true" data-type-id="${item.id}">
          <div class="glyph" style="font-size:${Math.min(item.size, 36)}px">${escapeHtml(item.char)}</div>
          <div class="type-meta">
            <strong>${escapeHtml(item.char)} · ${escapeHtml(item.style)}</strong>
            <span>${item.size}px · ${escapeHtml(item.wear)} · 已用${used}/${item.quantity}</span>
          </div>
          <button class="mini-btn" title="删除字模" data-delete-type="${item.id}" type="button">×</button>
        </article>
      `;
    })
    .join("");
}

function renderStage() {
  const { cols, rows } = getGrid();
  const map = new Map(state.placements.map((item) => [placementKey(item.row, item.col), item]));
  els.stage.className = `stage ${state.settings.paperSize}`;
  els.stage.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  els.stage.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  els.stage.style.gap = `${state.settings.gridGap}px`;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const placement = map.get(placementKey(row, col));
      const type = placement ? state.inventory.find((item) => item.id === placement.typeId) : null;
      const vertical = state.settings.flowMode === "vertical" ? "vertical" : "";
      cells.push(`
        <button class="cell ${type ? "used" : ""} ${vertical}" data-row="${row}" data-col="${col}" type="button" aria-label="第${row + 1}行第${col + 1}列">
          ${type ? escapeHtml(type.char) : ""}
        </button>
      `);
    }
  }
  els.stage.innerHTML = cells.join("");
}

function renderUsage() {
  const usage = getUsage();
  const entries = state.inventory.filter((item) => usage[item.id]);
  els.placedCount.textContent = `${state.placements.length}个落字`;

  const shortages = entries.filter((item) => usage[item.id] > item.quantity);
  els.shortageBadge.textContent = shortages.length ? `${shortages.length}处超量` : "数量充足";
  els.shortageBadge.className = `badge ${shortages.length ? "warn" : "ok"}`;

  const selectedType = getSelectedType();
  els.selectedTypeLabel.textContent = selectedType ? `当前：${selectedType.char} · ${selectedType.style}` : "未选择字模";

  els.usageList.innerHTML =
    entries
      .map((item) => {
        const used = usage[item.id];
        const warn = used > item.quantity ? "warn" : "";
        return `
          <div class="usage-item ${warn}">
            <strong>${escapeHtml(item.char)} ${escapeHtml(item.style)}</strong>
            <span>${used}/${item.quantity}</span>
          </div>
        `;
      })
      .join("") || `<p class="empty">还没有落字。</p>`;
}

function renderDrafts() {
  els.draftList.innerHTML =
    state.drafts
      .map(
        (draft) => `
          <article class="draft-item">
            <strong>${escapeHtml(draft.title)}</strong>
            <span>${draft.placements.length}个落字 · ${new Date(draft.savedAt).toLocaleString("zh-CN")}</span>
            <div class="draft-actions">
              <button type="button" data-load-draft="${draft.id}">载入</button>
              <button type="button" data-delete-draft="${draft.id}">删除</button>
            </div>
          </article>
        `
      )
      .join("") || `<p class="empty">还没有保存草稿。</p>`;
}

function renderAll() {
  saveState();
  renderSettings();
  renderStyleFilter();
  renderInventory();
  renderStage();
  renderUsage();
  renderDrafts();
}

function placeType(row, col, typeId = state.selectedTypeId) {
  if (!typeId) return;
  const existingIndex = state.placements.findIndex((item) => item.row === row && item.col === col);
  if (existingIndex >= 0) {
    if (state.placements[existingIndex].typeId === typeId) {
      state.placements.splice(existingIndex, 1);
    } else {
      state.placements[existingIndex].typeId = typeId;
    }
  } else {
    state.placements.push({ row, col, typeId });
  }
  renderAll();
  invalidateProofApplication();
}

function addType(event) {
  event.preventDefault();
  const item = {
    id: crypto.randomUUID(),
    char: els.charInput.value.trim(),
    style: els.styleInput.value.trim(),
    size: Number(els.sizeInput.value),
    quantity: Number(els.quantityInput.value),
    wear: els.wearInput.value
  };
  if (!item.char || !item.style) return;
  state.inventory.unshift(item);
  state.selectedTypeId = item.id;
  els.typeForm.reset();
  els.sizeInput.value = 24;
  els.quantityInput.value = 3;
  renderAll();
}

function saveDraft() {
  const title = state.settings.workTitle.trim() || "未命名作品";
  state.drafts.unshift({
    id: crypto.randomUUID(),
    title,
    settings: structuredClone(state.settings),
    placements: structuredClone(state.placements),
    savedAt: new Date().toISOString()
  });
  state.drafts = state.drafts.slice(0, 8);
  renderAll();
}

function exportPreview() {
  const { cols, rows } = getGrid();
  const cell = state.settings.paperSize === "bookmark" ? 44 : 56;
  const gap = state.settings.gridGap;
  const margin = 48;
  const width = cols * cell + (cols - 1) * gap + margin * 2;
  const height = rows * cell + (rows - 1) * gap + margin * 2 + 70;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fffaf1";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#2f2921";
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.fillStyle = "#22201c";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(state.settings.workTitle || "未命名作品", margin, 50);
  ctx.font = "bold 30px serif";
  state.placements.forEach((placement) => {
    const type = state.inventory.find((item) => item.id === placement.typeId);
    if (!type) return;
    const x = margin + placement.col * (cell + gap);
    const y = margin + 45 + placement.row * (cell + gap);
    ctx.fillStyle = "#2f2921";
    ctx.fillRect(x, y, cell, cell);
    ctx.fillStyle = "#fff5df";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.min(type.size + 8, 42)}px serif`;
    ctx.fillText(type.char, x + cell / 2, y + cell / 2);
  });
  const link = document.createElement("a");
  link.download = `${state.settings.workTitle || "movable-type"}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ============================================================
// 校字台：对读（LCS 对齐）、裁决、落版前核对、局部应用、校记
// ============================================================

let pickingMode = null; // { type: "start" } | { type: "target", pairId }

function posToIndex(row, col) {
  return row * getGrid().cols + col;
}

function indexToPos(index) {
  const { cols } = getGrid();
  return { row: Math.floor(index / cols), col: index % cols };
}

function cellLabel(row, col) {
  return `第${row + 1}行第${col + 1}列`;
}

// 最长公共子序列对齐，返回 match / add（校样多出）/ del（原稿多出）的操作序列
function alignChars(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < m; j += 1) {
      dp[i + 1][j + 1] = a[i].ch === b[j].ch ? dp[i][j] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1].ch === b[j - 1].ch) {
      ops.push({ kind: "match", orig: a[i - 1], rev: b[j - 1] });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ kind: "add", rev: b[j - 1] });
      j -= 1;
    } else {
      ops.push({ kind: "del", orig: a[i - 1] });
      i -= 1;
    }
  }
  return ops.reverse();
}

// 连续的 del / add 合并：一一配对为「换字」，其余为缺字 / 增字
function opsToPairs(ops) {
  const pairs = [];
  let k = 0;
  const seq = () => (pairs.length ? pairs[pairs.length - 1].seq + 1 : 0);
  while (k < ops.length) {
    const op = ops[k];
    if (op.kind === "match") {
      pairs.push({
        id: crypto.randomUUID(),
        kind: "same",
        orig: op.orig.ch,
        rev: op.rev.ch,
        origIndex: op.orig.index,
        revIndex: op.rev.index,
        resolve: "same",
        decided: false,
        typeChoice: null,
        targetPos: null,
        slotIndex: null,
        applied: false,
        seq: seq()
      });
      k += 1;
      continue;
    }
    const dels = [];
    const adds = [];
    while (k < ops.length && ops[k].kind !== "match") {
      if (ops[k].kind === "del") dels.push(ops[k].orig);
      else adds.push(ops[k].rev);
      k += 1;
    }
    const common = Math.min(dels.length, adds.length);
    for (let t = 0; t < common; t += 1) {
      pairs.push({
        id: crypto.randomUUID(),
        kind: "sub",
        orig: dels[t].ch,
        rev: adds[t].ch,
        origIndex: dels[t].index,
        revIndex: adds[t].index,
        resolve: "proof",
        decided: false,
        typeChoice: null,
        targetPos: null,
        slotIndex: null,
        applied: false,
        seq: seq()
      });
    }
    dels.slice(common).forEach((ch) => {
      pairs.push({
        id: crypto.randomUUID(),
        kind: "del",
        orig: ch.ch,
        rev: null,
        origIndex: ch.index,
        revIndex: null,
        resolve: "proof",
        decided: false,
        typeChoice: null,
        targetPos: null,
        slotIndex: null,
        applied: false,
        seq: seq()
      });
    });
    adds.slice(common).forEach((ch) => {
      pairs.push({
        id: crypto.randomUUID(),
        kind: "add",
        orig: null,
        rev: ch.ch,
        origIndex: null,
        revIndex: ch.index,
        resolve: "proof",
        decided: false,
        typeChoice: null,
        targetPos: null,
        slotIndex: null,
        applied: false,
        seq: seq()
      });
    });
  }
  return pairs;
}

function toCharUnits(text, ignoreSpace) {
  return Array.from(text)
    .map((ch, index) => ({ ch, index }))
    .filter(({ ch }) => !(ignoreSpace && /\s/.test(ch)));
}

// 相同 / 换字 / 缺字在版面流中连续占格；增字默认无格，待指定
function recomputeSlots() {
  const proof = state.proof;
  if (!proof.pairs.length) return;
  const start = posToIndex(proof.startRow, proof.startCol);
  let cursor = start;
  proof.pairs.forEach((pair) => {
    if (pair.kind === "add") {
      pair.slotIndex = null;
    } else {
      pair.slotIndex = cursor;
      cursor += 1;
    }
  });
}

function runCompare() {
  const proof = state.proof;
  const origUnits = toCharUnits(proof.origText, proof.ignoreSpace);
  const revUnits = toCharUnits(proof.revText, proof.ignoreSpace);
  if (!origUnits.length && !revUnits.length) {
    proof.pairs = [];
    return;
  }
  const { cols, rows } = getGrid();
  proof.startRow = Math.min(proof.startRow, rows - 1);
  proof.startCol = Math.min(proof.startCol, cols - 1);
  proof.pairs = opsToPairs(alignChars(origUnits, revUnits));
  proof.applied = false;
  proof.stale = false;
  proof.note = proof.note || "";
  recomputeSlots();
}

function pairDesiredChar(pair) {
  if (pair.kind === "same") return pair.orig;
  if (pair.kind === "add") return pair.resolve === "proof" ? pair.rev : null;
  if (pair.kind === "del") return pair.resolve === "orig" ? pair.orig : null;
  return pair.resolve === "proof" ? pair.rev : pair.orig; // sub
}

function pairPos(pair) {
  if (pair.kind === "add") return pair.targetPos;
  if (pair.slotIndex == null) return null;
  const { cols, rows } = getGrid();
  const pos = indexToPos(pair.slotIndex);
  if (pos.row >= rows || pos.col >= cols) return null;
  return pos;
}

function typeMatches(type, ch) {
  return type && type.char === ch;
}

// 汇总本次落版计划，并逐项核对缺字模 / 缺量 / 越界 / 位置冲突
function buildPlan() {
  const { cols, rows } = getGrid();
  const capacity = cols * rows;
  const map = new Map(state.placements.map((p) => [placementKey(p.row, p.col), p]));
  const problems = [];
  const ops = [];
  const satisfied = []; // 版面已与裁决一致、无需改动的条目
  const seenTargets = new Set();

  state.proof.pairs.filter((pair) => !pair.applied).forEach((pair) => {
    if (pair.kind === "same") return; // 相同字仅作对齐参照，不属于本次改动格
    const desired = pairDesiredChar(pair);
    if (pair.kind === "add" && pair.resolve !== "proof") {
      satisfied.push(pair); // 增字裁决为「不增」：版面无需改动，裁决即已落实
      return;
    }
    if (pair.kind === "del" && pair.resolve === "orig") {
      // 保留原稿：需把原稿字落到该格
      setOp(pair, pair.orig, false);
      return;
    }
    if (pair.kind === "del") {
      // 采用校样（删字）
      const pos = pairPos(pair);
      if (!pos) {
        problems.push({ level: "block", pair, code: "overflow", text: `缺字「${pair.orig}」对应${pair.slotIndex >= capacity ? "格位超出版面容量" : "格位无效"}，无法删改。` });
        return;
      }
      const key = placementKey(pos.row, pos.col);
      const existing = map.get(key);
      if (existing) {
        const existingType = state.inventory.find((t) => t.id === existing.typeId);
        if (existingType && existingType.char !== pair.orig) {
          problems.push({ level: "block", pair, code: "conflict", text: `${cellLabel(pos.row, pos.col)}现为「${existingType.char}」，与原稿缺字「${pair.orig}」位置冲突。` });
          return;
        }
        ops.push({ action: "delete", row: pos.row, col: pos.col, pair });
      } else {
        // 该格本就无字，删字结果已满足
        satisfied.push(pair);
      }
      return;
    }
    setOp(pair, desired, true);
  });

  function setOp(pair, desired, allowNew) {
    if (!desired) return;
    const { cols: gc, rows: gr } = getGrid();
    const capacityNow = gc * gr;
    let pos;
    if (pair.kind === "add") {
      pos = pair.targetPos;
      if (!pos) {
        problems.push({ level: "block", pair, code: "unplaced", text: `增字「${pair.rev}」尚未指定落格。` });
        return;
      }
    } else if (pair.slotIndex != null && pair.slotIndex >= capacityNow) {
      problems.push({ level: "block", pair, code: "overflow", text: `「${desired}」超出版面容量（第${pair.slotIndex + 1}格，版面仅${capacityNow}格）。` });
      return;
    } else {
      pos = indexToPos(pair.slotIndex);
    }
    if (pos.row >= gr || pos.col >= gc) {
      problems.push({ level: "block", pair, code: "overflow", text: `「${desired}」落格${cellLabel(pos.row, pos.col)}越界。` });
      return;
    }
    const key = placementKey(pos.row, pos.col);
    if (seenTargets.has(key)) {
      problems.push({ level: "block", pair, code: "conflict", text: `${cellLabel(pos.row, pos.col)}被两处改动同时指向，位置冲突。` });
      return;
    }
    seenTargets.add(key);
    const existing = map.get(key);
    const existingType = existing ? state.inventory.find((t) => t.id === existing.typeId) : null;
    if (existingType && existingType.char === desired) {
      satisfied.push(pair);
      return;
    }
    if (existingType && pair.kind === "add") {
      problems.push({ level: "block", pair, code: "conflict", text: `增字「${desired}」目标${cellLabel(pos.row, pos.col)}已有「${existingType.char}」，位置冲突。` });
      return;
    }
    if (existingType && pair.kind !== "add" && existingType.char !== pair.orig) {
      problems.push({ level: "block", pair, code: "conflict", text: `${cellLabel(pos.row, pos.col)}现为「${existingType.char}」，原稿应为「${pair.orig}」，位置不符。` });
      return;
    }
    const candidates = state.inventory.filter((t) => t.char === desired);
    let chosen = candidates.find((t) => t.id === pair.typeChoice) || candidates[0] || null;
    if (!chosen) {
      problems.push({
        level: "block",
        pair,
        code: "no-type",
        text: `字模库缺少「${desired}」字模${pair.kind === "add" ? "（增字）" : ""}，请先在字模库加入。`
      });
      return;
    }
    ops.push({ action: "set", row: pos.row, col: pos.col, typeId: chosen.id, char: desired, pair, keep: false });
  }

  // 模拟落版后的字模用量，查缺量
  const planned = new Map(map);
  ops.forEach((op) => {
    const key = placementKey(op.row, op.col);
    if (op.action === "delete") planned.delete(key);
    else planned.set(key, { row: op.row, col: op.col, typeId: op.typeId });
  });
  const usage = {};
  planned.forEach((p) => {
    usage[p.typeId] = (usage[p.typeId] || 0) + 1;
  });
  state.inventory.forEach((type) => {
    const used = usage[type.id] || 0;
    if (used > type.quantity) {
      problems.push({
        level: "block",
        code: "shortage",
        text: `「${type.char}」${type.style}落版后需 ${used} 枚，库存仅 ${type.quantity} 枚，缺 ${used - type.quantity} 枚。`
      });
    }
  });

  return { ops, problems, satisfied, plannedCount: planned.size, capacity };
}

function applyProof() {
  const { ops, problems, satisfied } = buildPlan();
  const blocking = problems.filter((p) => p.level === "block");
  if (blocking.length) return { ok: false };
  if (!ops.length) {
    // 所有裁决结果都已在版面上（或无需改动），只更新状态，不留空校记
    state.proof.pairs.forEach((pair) => {
      if (pair.kind !== "same") pair.applied = true;
    });
    state.proof.applied = true;
    return { ok: true, noop: true };
  }

  const before = new Map(state.placements.map((p) => [placementKey(p.row, p.col), p]));
  const touched = new Set();
  let added = 0;
  let removed = 0;
  let changed = 0;
  ops.forEach((op) => {
    const key = placementKey(op.row, op.col);
    touched.add(key);
    const had = before.has(key);
    if (op.action === "delete") {
      if (had) removed += 1;
      return;
    }
    if (had) {
      if (before.get(key).typeId !== op.typeId) changed += 1;
    } else {
      added += 1;
    }
  });

  // 只动被选中的格，其余落字原样保留
  ops.forEach((op) => {
    const key = placementKey(op.row, op.col);
    const index = state.placements.findIndex((p) => placementKey(p.row, p.col) === key);
    if (op.action === "delete") {
      if (index >= 0) state.placements.splice(index, 1);
    } else if (index >= 0) {
      state.placements[index].typeId = op.typeId;
    } else {
      state.placements.push({ row: op.row, col: op.col, typeId: op.typeId });
    }
  });

  const proof = state.proof;
  const appliedIds = new Set([...ops.map((op) => op.pair.id), ...satisfied.map((p) => p.id)]);
  proof.pairs.forEach((pair) => {
    if (appliedIds.has(pair.id)) pair.applied = true;
  });
  proof.applied = proof.pairs.filter((p) => p.kind !== "same").every((p) => p.applied);

  const countKind = (kind) => proof.pairs.filter((p) => p.kind === kind).length;
  state.proofRecords.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    title: state.settings.workTitle || "未命名作品",
    note: proof.note.trim(),
    start: cellLabel(proof.startRow, proof.startCol),
    origLength: toCharUnits(proof.origText, proof.ignoreSpace).length,
    revLength: toCharUnits(proof.revText, proof.ignoreSpace).length,
    stats: {
      same: countKind("same"),
      sub: countKind("sub"),
      add: countKind("add"),
      del: countKind("del"),
      applied: touched.size,
      added,
      removed,
      changed
    }
  });
  state.proofRecords = state.proofRecords.slice(0, 20);
  return { ok: true, noop: false, changed: touched.size };
}

// ---------- 校字台渲染 ----------

const kindLabel = { same: "相同", sub: "换字", add: "增字", del: "缺字" };

function renderStatus(plan) {
  const proof = state.proof;
  const el = els.proofStatusLine;
  if (!proof.pairs.length) {
    el.textContent = "尚未对读";
    el.className = "proof-status";
    return;
  }
  if (proof.stale) {
    el.textContent = "原稿或校样已改动，旧对读结果失效，请点击「开始对读」";
    el.className = "proof-status warn";
    return;
  }
  if (proof.applied) {
    el.textContent = "本次校改已落版，校记已留存";
    el.className = "proof-status ok";
    return;
  }
  const blocks = plan ? plan.problems.length : null;
  if (blocks === 0) {
    el.textContent = "核对通过，可以落版";
    el.className = "proof-status ok";
  } else if (blocks > 0) {
    el.textContent = `核对未通过：${blocks} 项拦住落版`;
    el.className = "proof-status warn";
  } else {
    const diffs = proof.pairs.filter((p) => p.kind !== "same").length;
    el.textContent = `对读完成，差异 ${diffs} 处，待落版前核对`;
    el.className = "proof-status";
  }
}

function renderProofInputs() {
  const proof = state.proof;
  els.origText.value = proof.origText;
  els.revText.value = proof.revText;
  els.ignoreSpace.checked = proof.ignoreSpace;
  els.proofNote.value = proof.note;
  els.origCount.textContent = `${toCharUnits(proof.origText, proof.ignoreSpace).length}字`;
  els.revCount.textContent = `${toCharUnits(proof.revText, proof.ignoreSpace).length}字`;
  els.startLabel.textContent = cellLabel(proof.startRow, proof.startCol);
  els.pickStartBtn.classList.toggle("picking", pickingMode?.type === "start");
}

function typeOptions(char, selectedId, currentTypeId) {
  const candidates = state.inventory.filter((t) => t.char === char);
  if (!candidates.length) return `<option value="">字模库无此字</option>`;
  const preferred = candidates.find((t) => t.id === selectedId) || candidates.find((t) => t.id === currentTypeId) || candidates[0];
  return candidates
    .map((t) => `<option value="${t.id}" ${t.id === preferred.id ? "selected" : ""}>${escapeHtml(t.style)} · ${t.size}px · 存${t.quantity}</option>`)
    .join("");
}

function renderPairList() {
  const proof = state.proof;
  if (!proof.pairs.length) {
    els.pairList.innerHTML = `<p class="empty">粘贴原稿与校样后点击「开始对读」。</p>`;
    els.diffSummary.hidden = true;
    return;
  }
  const counts = { same: 0, sub: 0, add: 0, del: 0 };
  const pending = proof.pairs.filter((p) => p.kind !== "same" && !p.decided).length;
  proof.pairs.forEach((p) => {
    counts[p.kind] += 1;
  });
  els.diffSummary.hidden = false;
  els.diffSummary.innerHTML = `
    <span class="summary-chip" data-filter="same">相同字 <b>${counts.same}</b></span>
    <span class="summary-chip chip-sub" data-filter="diff">换字 <b>${counts.sub}</b></span>
    <span class="summary-chip chip-add" data-filter="diff">增字 <b>${counts.add}</b></span>
    <span class="summary-chip chip-del" data-filter="diff">缺字 <b>${counts.del}</b></span>
    <span class="summary-chip" data-filter="pending">未决 <b>${pending}</b></span>
  `;

  const filter = proof.filter || "all";
  const pairs = proof.pairs.filter((p) => {
    if (filter === "same") return p.kind === "same";
    if (filter === "diff") return p.kind !== "same";
    if (filter === "pending") return p.kind !== "same" && !p.decided;
    return true;
  });

  const { cols, rows } = getGrid();
  const capacity = cols * rows;

  els.pairList.innerHTML =
    (proof.stale
      ? `<div class="stale-banner">原稿或校样已改动，以下为旧对读结果。请点击「开始对读」按当前内容重新对齐后再裁决、落版。</div>`
      : "") +
    pairs
    .map((pair) => {
      const isAdd = pair.kind === "add";
      const isDel = pair.kind === "del";
      let pos;
      let posText;
      if (isAdd) {
        if (pair.resolve === "orig") posText = "不增入版面";
        else {
          pos = pair.targetPos;
          posText = pos ? cellLabel(pos.row, pos.col) : "未指定格";
        }
      } else {
        const outside = pair.slotIndex >= capacity;
        pos = outside ? null : indexToPos(pair.slotIndex);
        posText = outside ? `版面外（第${pair.slotIndex + 1}格）` : cellLabel(pos.row, pos.col);
      }
      const desired = pairDesiredChar(pair);
      const skipType = (isDel && pair.resolve === "proof") || (isAdd && pair.resolve === "orig");
      const needsType = desired && !skipType && pair.kind !== "same";
      const existingType = (() => {
        if (!pos) return null;
        const placement = state.placements.find((p) => p.row === pos.row && p.col === pos.col);
        return placement ? state.inventory.find((t) => t.id === placement.typeId) : null;
      })();
      const origView = pair.orig == null
        ? `<span class="pair-char empty">（无原稿字）</span>`
        : `<span class="pair-char">${escapeHtml(pair.orig)}</span>`;
      const revView = pair.rev == null
        ? `<span class="pair-char empty">（校样缺此字）</span>`
        : `<span class="pair-char">${escapeHtml(pair.rev)}</span>`;
      let actions = "";
      if (pair.kind === "same") {
        actions = `<span class="applied-tag">同字照排</span>`;
      } else if (proof.stale) {
        actions = `<span class="applied-tag">结果已失效</span>`;
      } else if (pair.applied) {
        actions = `<span class="applied-tag">已落版</span>`;
      } else {
        const proofLabel = pair.kind === "sub" ? "采用校样" : pair.kind === "add" ? "增入校样" : "删去";
        const origLabel = pair.kind === "sub" ? "保留原稿" : pair.kind === "add" ? "不增" : "保留原稿";
        actions = `
          <button type="button" data-decide="proof" data-pair="${pair.id}"
            class="${pair.resolve === "proof" ? "chosen-proof" : ""}">${proofLabel}</button>
          <button type="button" data-decide="orig" data-pair="${pair.id}"
            class="${pair.resolve === "orig" ? "chosen-orig" : ""}">${origLabel}</button>
        `;
        if (isAdd && pair.resolve === "proof") {
          actions += `<button type="button" class="target-pick ${pickingMode?.type === "target" && pickingMode.pairId === pair.id ? "picking" : ""}"
            data-pick-target="${pair.id}">${pos ? "改选落格" : "点选落格"}</button>`;
        }
      }
      const typeSelect = needsType
        ? `<select class="pair-type-select" data-type-pair="${pair.id}" ${pair.applied || proof.stale ? "disabled" : ""}>
             ${typeOptions(desired, pair.typeChoice, existingType?.id)}
           </select>`
        : `<span class="pair-sub">&nbsp;</span>`;
      return `
        <article class="pair-row kind-${pair.kind} ${pair.applied ? "applied" : ""} ${proof.stale ? "stale" : ""}" data-pair-row="${pair.id}">
          <div class="pair-pos">
            <span class="kind-badge ${pair.kind}">${kindLabel[pair.kind]}</span>
            <span data-pos-label="${pair.id}">${posText}</span>
          </div>
          <div class="pair-cell ${isAdd ? "cell-ghost" : ""}">
            ${origView}
            <span class="pair-sub">原稿${pair.origIndex != null ? `第${pair.origIndex + 1}字` : ""}</span>
          </div>
          <div class="pair-cell ${isDel ? "cell-ghost" : ""}">
            ${revView}
            <span class="pair-sub">${
              isDel && pair.resolve === "proof"
                ? "该格将清空"
                : pair.revIndex != null ? `校样第${pair.revIndex + 1}字` : "&nbsp;"
            }</span>
            ${typeSelect}
          </div>
          <div class="pair-actions">${actions}</div>
        </article>
      `;
    })
    .join("");

  if (!pairs.length) {
    els.pairList.innerHTML = `<p class="empty">当前筛选下没有对读条目。</p>`;
  }
}

function renderPreflight(plan) {
  if (!state.proof.pairs.length) {
    els.preflightList.innerHTML = `<p class="empty">对读并裁决差异后，落版前在此统一核对。</p>`;
    els.applyProofBtn.disabled = false;
    els.applyProofBtn.textContent = "核对并落版应用";
    return;
  }
  if (state.proof.stale) {
    els.preflightList.innerHTML = `
      <div class="preflight-item block"><span class="pf-icon">!</span><span>原稿或校样已改动，当前对读结果已失效，不能据此落版。请先「开始对读」重新对齐。</span></div>`;
    els.applyProofBtn.disabled = true;
    els.applyProofBtn.textContent = "结果已失效，请重新对读";
    return;
  }
  if (state.proof.applied) {
    els.preflightList.innerHTML = `
      <div class="preflight-item ok"><span class="pf-icon">✓</span><span>已按裁决落版，本次改动的格均已写入版面。</span></div>
      <div class="preflight-item ok"><span class="pf-icon">✓</span><span>其他落字、草稿与版面设置未改动；可「重新对读」继续校对。</span></div>`;
    els.applyProofBtn.disabled = true;
    els.applyProofBtn.textContent = "已落版（见下方校记）";
    return;
  }
  const usedPlan = plan || buildPlan();
  const { problems, ops, plannedCount, capacity } = usedPlan;
  const setOps = ops.filter((op) => op.action === "set");
  const items = [];
  if (problems.length) {
    problems.slice(0, 40).forEach((problem) => {
      items.push(`
        <div class="preflight-item block">
          <span class="pf-icon">!</span>
          <span>${escapeHtml(problem.text)}</span>
        </div>`);
    });
    if (problems.length > 40) {
      items.push(`<div class="preflight-item block"><span class="pf-icon">…</span><span>另有 ${problems.length - 40} 项问题。</span></div>`);
    }
  } else {
    items.push(`<div class="preflight-item ok"><span class="pf-icon">✓</span><span>版面容量：${plannedCount}/${capacity} 格，无越界。</span></div>`);
    const usage = {};
    setOps.forEach((op) => {
      usage[op.typeId] = (usage[op.typeId] || 0) + 1;
    });
    Object.keys(usage).forEach((typeId) => {
      const type = state.inventory.find((t) => t.id === typeId);
      if (!type) return;
      items.push(`<div class="preflight-item ok"><span class="pf-icon">✓</span><span>「${escapeHtml(type.char)}」本次动用 ${usage[typeId]} 枚，库存 ${type.quantity} 枚。</span></div>`);
    });
    items.push(`<div class="preflight-item ok"><span class="pf-icon">✓</span><span>改动 ${setOps.length} 格、清字 ${ops.length - setOps.length} 格${usedPlan.satisfied.length ? `、${usedPlan.satisfied.length} 处已与版面一致` : ""}，无位置冲突。</span></div>`);
  }
  els.preflightList.innerHTML = items.join("");
  els.applyProofBtn.disabled = false;
  els.applyProofBtn.textContent = problems.length
    ? `核对并落版应用（${problems.length} 项拦住）`
    : "核对无误，落版应用";
}

function renderProofBoard() {
  const { cols, rows } = getGrid();
  const proof = state.proof;
  const stage = els.proofStage;
  stage.className = `stage proof-stage ${state.settings.paperSize}`;
  stage.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  stage.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  stage.style.gap = `${Math.max(4, state.settings.gridGap - 3)}px`;

  const placementMap = new Map(state.placements.map((p) => [placementKey(p.row, p.col), p]));
  const overlay = new Map(); // key -> classes/glyph
  if (proof.pairs.length) {
    overlay.set(placementKey(proof.startRow, proof.startCol), { cls: "pf-start", glyph: null });
    if (!proof.stale) {
      proof.pairs.forEach((pair) => {
        if (pair.applied) return;
        const pos = pairPos(pair);
        if (!pos) return;
        const key = placementKey(pos.row, pos.col);
        let cls = "";
        let glyph = null;
        if (pair.kind === "same") {
          cls = "pf-same";
          glyph = pair.orig;
        } else if (pair.kind === "sub") {
          cls = "pf-sub";
          glyph = pairDesiredChar(pair);
        } else if (pair.kind === "del") {
          cls = pair.resolve === "orig" ? "pf-sub" : "pf-del";
          glyph = pair.orig;
        } else if (pair.kind === "add" && pair.resolve === "proof") {
          cls = "pf-add";
          glyph = pair.rev;
        }
        if (cls) overlay.set(key, { cls, glyph, pairId: pair.id });
      });
    }
  }

  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = placementKey(row, col);
      const placement = placementMap.get(key);
      const type = placement ? state.inventory.find((t) => t.id === placement.typeId) : null;
      const mark = overlay.get(key);
      const classes = ["cell"];
      if (type) classes.push("used");
      if (state.settings.flowMode === "vertical") classes.push("vertical");
      if (pickingMode) classes.push("pickable");
      if (mark) classes.push(mark.cls);
      let glyph = type ? type.char : "";
      if (mark?.glyph && (!type || mark.glyph !== type.char)) glyph = mark.glyph;
      if (mark?.strike) glyph = String(glyph || "").split("").join("̶") || "×";
      cells.push(`
        <button type="button" class="${classes.join(" ")}" data-row="${row}" data-col="${col}"
          ${mark?.pairId ? `data-overlay-pair="${mark.pairId}"` : ""}
          aria-label="${cellLabel(row, col)}">${escapeHtml(glyph)}</button>
      `);
    }
  }
  stage.innerHTML = cells.join("");
  els.proofBoardHint.textContent = pickingMode
    ? pickingMode.type === "start"
      ? "在格中点击设定对读起始格"
      : "在格中点击为增字选落格"
    : "同色框表示对应格";
}

function renderRecords() {
  if (!state.proofRecords.length) {
    els.recordList.innerHTML = `<p class="empty">尚无校记。落版应用后自动留存本次校记。</p>`;
    return;
  }
  els.recordList.innerHTML = state.proofRecords
    .map((record) => {
      const s = record.stats;
      return `
        <article class="record-item">
          <div class="record-top">
            <span>${escapeHtml(record.title)}</span>
            <span>${new Date(record.at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div class="record-stats">
            原稿${record.origLength}字 / 校样${record.revLength}字 · 起${escapeHtml(record.start)}<br/>
            相同${s.same} · 换${s.sub} · 增${s.add} · 缺${s.del}；
            实落${s.applied}格（增${s.added} 删${s.removed} 换${s.changed}）
          </div>
          ${record.note ? `<div class="record-note">${escapeHtml(record.note)}</div>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderProofAll() {
  recomputeSlots();
  saveState();
  renderProofInputs();
  const plan = state.proof.pairs.length ? buildPlan() : null;
  renderPairList();
  renderPreflight(plan);
  renderProofBoard();
  renderRecords();
  renderStatus(plan);
}

// ---------- 校字台交互 ----------

function markDecisionsUnapplied() {
  state.proof.applied = false;
}

document.querySelectorAll(".tab-btn").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((t) => t.classList.toggle("active", t === tab));
    const isProof = tab.dataset.view === "proof";
    els.typesetView.hidden = isProof;
    els.proofView.hidden = !isProof;
    state.ui = { view: isProof ? "proof" : "typeset" };
    saveState();
    if (isProof) renderProofAll();
  });
});

function markProofStale() {
  if (!state.proof.pairs.length) {
    saveState();
    return;
  }
  state.proof.stale = true;
  state.proof.applied = false;
  pickingMode = null;
  saveState();
  if (!els.proofView.hidden) renderProofAll();
}

els.origText.addEventListener("input", () => {
  state.proof.origText = els.origText.value;
  els.origCount.textContent = `${toCharUnits(els.origText.value, els.ignoreSpace.checked).length}字`;
  markProofStale();
});
els.revText.addEventListener("input", () => {
  state.proof.revText = els.revText.value;
  els.revCount.textContent = `${toCharUnits(els.revText.value, els.ignoreSpace.checked).length}字`;
  markProofStale();
});
els.ignoreSpace.addEventListener("change", () => {
  state.proof.ignoreSpace = els.ignoreSpace.checked;
  renderProofInputs();
  markProofStale();
});
els.proofNote.addEventListener("input", () => {
  state.proof.note = els.proofNote.value;
  saveState();
});

els.compareBtn.addEventListener("click", () => {
  if (!state.proof.origText.trim() && !state.proof.revText.trim()) {
    els.compareHint.textContent = "请先粘贴原稿或校样。";
    return;
  }
  pickingMode = null;
  runCompare();
  els.compareHint.textContent = "对读完成：差异处可逐条裁决，也可批量采用；落版前将统一核对。";
  renderProofAll();
});

els.resetProofBtn.addEventListener("click", () => {
  state.proof.pairs = [];
  state.proof.applied = false;
  state.proof.stale = false;
  pickingMode = null;
  els.compareHint.textContent = "对读结果已清空，可调整原稿/校样后重新对读。";
  renderProofAll();
});

els.pickStartBtn.addEventListener("click", () => {
  pickingMode = pickingMode?.type === "start" ? null : { type: "start" };
  renderProofBoard();
  renderPairList();
});

els.proofStage.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell || !pickingMode) return;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  if (pickingMode.type === "start") {
    if (state.proof.startRow === row && state.proof.startCol === col) {
      pickingMode = null;
      return;
    }
    state.proof.startRow = row;
    state.proof.startCol = col;
    // 起始格移动后所有槽位重排，原落版结果失效；增字旧目标一并清掉
    state.proof.pairs.forEach((p) => {
      p.applied = false;
      if (p.kind === "add") p.targetPos = null;
    });
    state.proof.applied = false;
  } else {
    const pair = state.proof.pairs.find((p) => p.id === pickingMode.pairId);
    if (pair) {
      pair.targetPos = { row, col };
      pair.applied = false; // 重新选格后该增字需重新落版
      state.proof.applied = false;
    }
  }
  pickingMode = null;
  markDecisionsUnapplied();
  renderProofAll();
});

els.pairList.addEventListener("click", (event) => {
  if (state.proof.stale) return;
  const decideBtn = event.target.closest("[data-decide]");
  const pickBtn = event.target.closest("[data-pick-target]");
  if (decideBtn) {
    const pair = state.proof.pairs.find((p) => p.id === decideBtn.dataset.pair);
    if (!pair) return;
    if (pair.resolve !== decideBtn.dataset.decide) pair.applied = false;
    pair.resolve = decideBtn.dataset.decide;
    pair.decided = true;
    if (pair.kind === "add" && pair.resolve !== "proof") pair.targetPos = null;
    markDecisionsUnapplied();
    renderProofAll();
    return;
  }
  if (pickBtn) {
    const pairId = pickBtn.dataset.pickTarget;
    pickingMode = pickingMode?.type === "target" && pickingMode.pairId === pairId ? null : { type: "target", pairId };
    renderProofBoard();
    renderPairList();
  }
});

els.pairList.addEventListener("change", (event) => {
  const select = event.target.closest("[data-type-pair]");
  if (!select) return;
  const pair = state.proof.pairs.find((p) => p.id === select.dataset.typePair);
  if (!pair) return;
  pair.typeChoice = select.value || null;
  pair.applied = false;
  renderProofAll();
});

els.pairList.addEventListener("mouseover", (event) => {
  const row = event.target.closest("[data-pair-row]");
  if (!row) return;
  els.proofStage.querySelectorAll(`[data-overlay-pair="${row.dataset.pairRow}"]`).forEach((cell) => cell.classList.add("row-hover"));
});
els.pairList.addEventListener("mouseout", (event) => {
  const row = event.target.closest("[data-pair-row]");
  if (!row) return;
  els.proofStage.querySelectorAll(`[data-overlay-pair="${row.dataset.pairRow}"]`).forEach((cell) => cell.classList.remove("row-hover"));
});

els.diffSummary.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-filter]");
  if (!chip) return;
  state.proof.filter = chip.dataset.filter;
  renderPairList();
  syncFilterButtons();
});
els.diffFilter.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-filter]");
  if (!btn) return;
  state.proof.filter = btn.dataset.filter;
  renderPairList();
  syncFilterButtons();
});
function syncFilterButtons() {
  els.diffFilter.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === (state.proof.filter || "all"));
  });
}

els.batchProofBtn.addEventListener("click", () => {
  if (state.proof.stale) return;
  state.proof.pairs.forEach((p) => {
    if (p.kind !== "same") {
      if (p.resolve !== "proof") p.applied = false;
      p.resolve = "proof";
      p.decided = true;
    }
  });
  els.compareHint.textContent = "已全部按校样裁决；增字仍需逐一点选落格（或越界时由核对拦下）。";
  markDecisionsUnapplied();
  renderProofAll();
});
els.batchOrigBtn.addEventListener("click", () => {
  if (state.proof.stale) return;
  state.proof.pairs.forEach((p) => {
    if (p.kind !== "same") {
      if (p.resolve !== "orig") p.applied = false;
      p.resolve = "orig";
      p.decided = true;
      if (p.kind === "add") p.targetPos = null;
    }
  });
  els.compareHint.textContent = "已全部保留原稿；版面不增不删，仅按原稿补齐字模。";
  markDecisionsUnapplied();
  renderProofAll();
});

els.preflightBtn.addEventListener("click", () => {
  pickingMode = null;
  renderProofAll();
});

els.applyProofBtn.addEventListener("click", () => {
  if (!state.proof.pairs.length) {
    els.compareHint.textContent = "请先对读，再落版应用。";
    return;
  }
  if (state.proof.stale) {
    els.compareHint.textContent = "原稿或校样已改动，旧结果失效，请先「开始对读」重新对齐。";
    return;
  }
  const result = applyProof();
  if (!result.ok) {
    const { problems } = buildPlan();
    els.compareHint.textContent = `落版被拦住 ${problems.length} 项，请按「落版前核对」清单逐项处理后再应用。`;
    renderProofAll();
    return;
  }
  els.compareHint.textContent = result.noop
    ? "核对通过：所有裁决结果均已在版面中，未作改动，也不另记空校记。"
    : "已按裁决落版：仅改动选定格，其他落字、草稿与版面设置均未改动；校记已留存。";
  pickingMode = null;
  renderAll();
  renderProofAll();
});

// 版面在校字台之外被改动（手动落字、清空、载入草稿、删字模、换纸张等）：
// 已落版标记立即失效，回到「待核对」状态，结果仍可查看但必须重新核对。
// 注意：不清 stale——文本失效只能由「开始对读」解除。
function invalidateProofApplication() {
  if (!state.proof.pairs.length) return;
  state.proof.applied = false;
  state.proof.pairs.forEach((p) => {
    p.applied = false;
  });
  pickingMode = null;
  saveState();
  if (!els.proofView.hidden) renderProofAll();
}

function syncProofAfterBoardChange() {
  if (state.proof.pairs.length) {
    const { cols, rows } = getGrid();
    state.proof.startRow = Math.min(state.proof.startRow, rows - 1);
    state.proof.startCol = Math.min(state.proof.startCol, cols - 1);
    state.proof.pairs.forEach((p) => {
      if (p.targetPos && (p.targetPos.row >= rows || p.targetPos.col >= cols)) p.targetPos = null;
    });
    invalidateProofApplication();
  } else {
    saveState();
  }
}

els.paperSize.addEventListener("change", () => {
  state.settings.paperSize = els.paperSize.value;
  const { cols, rows } = getGrid();
  state.placements = state.placements.filter((item) => item.row < rows && item.col < cols);
  renderAll();
  syncProofAfterBoardChange();
});

els.flowMode.addEventListener("change", () => {
  state.settings.flowMode = els.flowMode.value;
  renderAll();
  if (!els.proofView.hidden) renderProofBoard();
});

els.gridGap.addEventListener("input", () => {
  state.settings.gridGap = Number(els.gridGap.value);
  renderAll();
  if (!els.proofView.hidden) renderProofBoard();
});

els.workTitle.addEventListener("input", () => {
  state.settings.workTitle = els.workTitle.value;
  saveState();
});

els.typeForm.addEventListener("submit", addType);
els.inventorySearch.addEventListener("input", renderInventory);
els.styleFilter.addEventListener("change", renderInventory);
els.saveDraftBtn.addEventListener("click", saveDraft);
els.exportBtn.addEventListener("click", exportPreview);
els.clearBoardBtn.addEventListener("click", () => {
  state.placements = [];
  renderAll();
  invalidateProofApplication();
});

els.typeList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-type]");
  if (deleteButton) {
    const typeId = deleteButton.dataset.deleteType;
    const wasPlaced = state.placements.some((item) => item.typeId === typeId);
    const wasChosen = state.proof.pairs.some((item) => item.typeChoice === typeId);
    state.inventory = state.inventory.filter((item) => item.id !== typeId);
    state.placements = state.placements.filter((item) => item.typeId !== typeId);
    if (state.selectedTypeId === typeId) state.selectedTypeId = state.inventory[0]?.id || null;
    renderAll();
    if (wasPlaced || wasChosen) invalidateProofApplication();
    return;
  }
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  state.selectedTypeId = card.dataset.typeId;
  renderAll();
});

els.typeList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.typeId);
});

els.stage.addEventListener("dragover", (event) => {
  if (event.target.closest(".cell")) event.preventDefault();
});

els.stage.addEventListener("drop", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  event.preventDefault();
  placeType(Number(cell.dataset.row), Number(cell.dataset.col), event.dataTransfer.getData("text/plain"));
});

els.stage.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  placeType(Number(cell.dataset.row), Number(cell.dataset.col));
});

els.draftList.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-load-draft]");
  const deleteButton = event.target.closest("[data-delete-draft]");
  if (loadButton) {
    const draft = state.drafts.find((item) => item.id === loadButton.dataset.loadDraft);
    if (!draft) return;
    state.settings = structuredClone(draft.settings);
    state.placements = structuredClone(draft.placements);
    renderAll();
    invalidateProofApplication();
  }
  if (deleteButton) {
    state.drafts = state.drafts.filter((item) => item.id !== deleteButton.dataset.deleteDraft);
    renderAll();
  }
});

renderAll();

// 恢复上次所在视图与校字台状态（原稿、校样、裁决、校记均存本地）
(function initProofView() {
  const startOnProof = state.ui?.view === "proof";
  const proofTab = document.querySelector('.tab-btn[data-view="proof"]');
  const typesetTab = document.querySelector('.tab-btn[data-view="typeset"]');
  proofTab.classList.toggle("active", startOnProof);
  typesetTab.classList.toggle("active", !startOnProof);
  els.typesetView.hidden = startOnProof;
  els.proofView.hidden = !startOnProof;
  syncFilterButtons();
  if (startOnProof) {
    renderProofAll();
  } else {
    renderProofInputs();
    renderProofBoard();
    renderRecords();
    renderStatus(null);
  }
})();
