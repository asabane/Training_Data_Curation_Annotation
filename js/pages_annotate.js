'use strict';
// ============================================================
// PAGES — Annotation Queue, Annotation Screen, My Submissions
// ============================================================

// ── QUEUE ─────────────────────────────────────────────────────
Pages.queue = function () {
  const u = Auth.currentUser;
  const myIAs = DB.itemAssignments.byUser(u.user_id);
  const pending = [], completed = [], rejected = [];
  myIAs.forEach(ia => {
    const ann = DB.annotations.byItemAndUser(ia.item_id, u.user_id);
    const item = DB.items.get(ia.item_id);
    if (!item) return;
    const proj = DB.projects.get(item.project_id);
    const row = { ia, item, ann, proj };
    if (!ann || ann.status === 'draft' || ann.status === 're_annotation_required') pending.push(row);
    else if (ann.status === 'rejected') rejected.push(row);
    else completed.push(row);
  });
  const renderList = (rows, emptyMsg) => !rows.length ? `<div class="empty-state" style="padding:30px"><div class="empty-icon" style="font-size:36px">✅</div><div class="empty-msg">${emptyMsg}</div></div>` :
    rows.map(({ ia, item, ann, proj }) => {
      const status = ann?.status || 'pending';
      const isRedo = status === 're_annotation_required';
      return `<div class="queue-item" onclick="Router.navigate('annotate',{itemId:'${ia.item_id}',iaId:'${ia.ia_id}'})">
        <span style="font-size:18px">${isRedo ? '🔄' : '✏️'}</span>
        <div class="queue-item-text">${Utils.esc((item.text || item.prompt || '—').slice(0, 100))}</div>
        <div class="queue-item-meta">
          ${isRedo ? '<span class="badge badge-danger">Redo Required</span>' : ''}
          <span class="badge badge-muted">${Utils.esc(proj?.project_name || '—')}</span>
          <span class="badge badge-muted">${Utils.taskLabel(proj?.task_type || '')}</span>
        </div></div>`;
    }).join('');
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">✏️ My Annotation Queue</div>
        <div class="page-subtitle">${pending.length} pending · ${rejected.length} rejected · ${completed.length} completed</div></div>
    </div>
    <div class="tabs">
      <div class="tab active" id="tab-pend" onclick="Pages._switchTab('pend')">⏳ Pending (${pending.length})</div>
      <div class="tab" id="tab-rej" onclick="Pages._switchTab('rej')">❌ Rejected (${rejected.length})</div>
      <div class="tab" id="tab-done" onclick="Pages._switchTab('done')">✅ Completed (${completed.length})</div>
    </div>
    <div id="tab-pend-body">${renderList(pending, 'No pending items. Great job!')}</div>
    <div id="tab-rej-body" class="hidden">${renderList(rejected, 'No rejected items.')}</div>
    <div id="tab-done-body" class="hidden">${renderList(completed, 'No completed items yet.')}</div>`;
};
Pages._switchTab = t => {
  ['pend','rej','done'].forEach(id => {
    document.getElementById(`tab-${id}`).classList.toggle('active', id === t);
    document.getElementById(`tab-${id}-body`).classList.toggle('hidden', id !== t);
  });
};

// ── ANNOTATE ──────────────────────────────────────────────────
Pages.annotate = function (itemId, iaId) {
  const u = Auth.currentUser;
  const item = DB.items.get(itemId);
  const ia = DB.itemAssignments.get(iaId);
  if (!item || !ia) { Toast.error('Item not found.'); Router.navigate('queue'); return; }
  const proj = DB.projects.get(item.project_id);
  if (!proj) { Toast.error('Project not found.'); Router.navigate('queue'); return; }
  const existingAnn = DB.annotations.byItemAndUser(itemId, u.user_id);
  const labels = proj.label_set?.length ? proj.label_set : Utils.defaultLabels(proj.task_type);
  const myIAs = DB.itemAssignments.byUser(u.user_id);
  const pendingIAs = myIAs.filter(x => { const a = DB.annotations.byItemAndUser(x.item_id, u.user_id); return !a || a.status === 'draft' || a.status === 're_annotation_required'; });
  const currentIdx = pendingIAs.findIndex(x => x.ia_id === iaId);
  const total = pendingIAs.length;
  const pct = total > 0 ? Utils.pct(myIAs.length - total, myIAs.length) : 100;

  const labelColors = ['v-green', 'v-red', 'v-yellow', 'v-purple', 'v-cyan', 'v-orange'];
  const labelIcons = { 'Positive': '😊', 'Negative': '😞', 'Neutral': '😐', 'Correct': '✅', 'Partially Correct': '⚠️', 'Incorrect': '❌', 'Hallucination': '🤔', 'Complaint': '😤', 'Query': '❓', 'Praise': '👏', 'Feedback': '💬', 'Response A Better': '🅰️', 'Response B Better': '🅱️', 'Both Same': '🟰', 'Both Bad': '👎' };

  const isReview = existingAnn?.status === 're_annotation_required';
  const prevLabel = existingAnn?.annotator_label || '';
  const prevComment = existingAnn?.annotator_comment || '';

  // --- Active Timer Logic ---
  Pages._activeTimerSeconds = 0;
  if (Pages._timerInterval) clearInterval(Pages._timerInterval);
  Pages._timerInterval = setInterval(() => {
    if (!document.hidden) {
      Pages._activeTimerSeconds++;
      const min = String(Math.floor(Pages._activeTimerSeconds / 60)).padStart(2, '0');
      const sec = String(Pages._activeTimerSeconds % 60).padStart(2, '0');
      const timerEl = document.getElementById('ann-timer');
      if (timerEl) {
        timerEl.innerHTML = `<span class="timer-dot"></span> ${min}:${sec}`;
        timerEl.className = 'timer-badge active';
      }
    } else {
      const timerEl = document.getElementById('ann-timer');
      if (timerEl) timerEl.className = 'timer-badge idle';
    }
  }, 1000);
  
  const timerHtml = `<div class="timer-badge active" id="ann-timer" style="margin-left:15px"><span class="timer-dot"></span> 00:00</div>`;

  Pages._annStartTime = Date.now();
  Pages._activeLabelsList = labels;

  if (proj.task_type === 'ner') {
    // ── 2-PANE NER WORKSPACE ────────────────────────────────────
    Pages._nerEntities = existingAnn?.ner_entities ? JSON.parse(existingAnn.ner_entities) : [];
    Pages._nerText = item.text || item.prompt || '';
    Pages._selectedSpanIdx = -1;

    const centerPanel = `<div style="flex:2.5;background:var(--bg-elevated);padding:25px;border-radius:var(--r-md);display:flex;flex-direction:column;border:1px solid var(--border)">
      <div style="margin-bottom:15px;display:flex;justify-content:space-between;align-items:center">
          <span class="badge badge-muted">Item ${myIAs.length - total + currentIdx + 1} of ${myIAs.length}</span>
          <div class="progress-wrap" style="width:150px;margin:0"><div class="progress-bar" style="width:${pct}%"></div></div>
      </div>
      
      <details class="instruction-panel" style="margin-bottom:12px">
        <summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--text-2)">📋 Instructions</summary>
        <div style="font-size:13px;color:var(--text-2);margin-top:8px;padding-left:16px;white-space:pre-wrap;border-left:2px solid var(--border)">${Utils.esc(proj.instructions)}</div>
      </details>
      
      <div style="font-size:12px;color:var(--text-3);margin-bottom:6px">Select Label (Keyboard 1-${labels.length}):</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:15px" id="ner-legend">
        ${labels.map((l,i)=>`<div class="label-btn" style="padding:4px 8px;font-size:14px;border:1px solid ${Pages._nerColor(i)};border-bottom:3px solid ${Pages._nerColor(i)}" id="ner-lbl-btn-${i}" onclick="Pages._setNerActiveLabel('${Utils.esc(l)}', ${i})"><span style="margin-right:6px;opacity:0.5">${i+1}.</span>${Utils.esc(l)}</div>`).join('')}
      </div>

      <div style="font-size:12px;color:var(--text-3);margin-bottom:10px;border-top:1px solid var(--border);padding-top:15px">Highlight text below to create a span:</div>
      <div class="text-display ner-workspace-text" id="ner-text" onmouseup="Pages._nerSelect()" style="font-size:16px;line-height:2;min-height:300px;background:none;border:none;white-space:pre-wrap"></div>
    </div>`;

    const rightPanel = `<div style="flex:1;background:var(--bg-elevated);padding:20px;border-radius:var(--r-md);display:flex;flex-direction:column;border:1px solid var(--border)">
      <div class="card-title" style="margin-bottom:10px">Annotated Spans</div>
      <div id="ner-list" style="flex:1;overflow-y:auto;margin-bottom:20px;display:flex;flex-direction:column;gap:8px"></div>
      
      <textarea class="form-textarea" id="ann-comment" placeholder="Opt. comment..." rows="2" style="margin-bottom:12px">${Utils.esc(prevComment)}</textarea>
      
      <div style="font-size:12px;color:var(--text-3);margin-bottom:4px">Confidence:</div>
      <div class="confidence-group" style="margin-bottom:16px">
          <div class="conf-btn ${existingAnn?.confidence_level==='high'?'active-high':''}" data-conf="high" onclick="Pages._setConf(this)">High</div>
          <div class="conf-btn ${existingAnn?.confidence_level==='medium'?'active-medium':''}" data-conf="medium" onclick="Pages._setConf(this)">Med</div>
          <div class="conf-btn ${existingAnn?.confidence_level==='low'?'active-low':''}" data-conf="low" onclick="Pages._setConf(this)">Low</div>
      </div>
      
      <div style="display:flex;gap:10px;margin-bottom:12px">
          <button class="btn btn-ghost" onclick="Pages._skipItem('${iaId}')">Skip</button>
          <button class="btn btn-primary" style="flex:1" onclick="Pages._submitAnnotation('${itemId}','${iaId}','${proj.project_id}','${proj.task_type}')">Submit ✓</button>
      </div>
      <div style="font-size:11px;color:var(--text-3);text-align:center;background:var(--bg-base);padding:10px;border-radius:6px">
        <strong>Shortcuts</strong><br/>
        Ctrl+Z : Undo last<br/>
        Del : Delete selected<br/>
        Enter : Submit
      </div>
    </div>`;

    document.getElementById('main-content').innerHTML = `
      <div class="page-header" style="margin-bottom:16px">
        <div><div class="page-title">${Utils.esc(proj.project_name)}</div>
        <div class="page-subtitle" style="display:flex;align-items:center;gap:10px">Span Annotation (NER) ${isReview ? '· ⚠️ REDO REQUIRED' : ''} ${timerHtml}</div></div>
        <button class="btn btn-ghost btn-sm" onclick="Pages._unbindNerShortcuts(); Router.navigate('queue')">← Queue</button>
      </div>
      <div style="display:flex;gap:20px;align-items:stretch;height:calc(100vh - 120px);padding-bottom:20px" id="ner-layout-container">
          ${centerPanel}${rightPanel}
      </div>`;
      
    Pages._setNerActiveLabel(labels[0], 0);
    Pages._renderNerText();
    Pages._bindNerShortcuts(itemId, iaId, proj.project_id, proj.task_type);
    
  } else {
    // ── STANDARD LAYOUT ─────────────────────────────────────────
    let taskHTML = '';
    if (proj.task_type === 'response_comparison') {
      Pages._currentItemA = item.response_a || '';
      Pages._currentItemB = item.response_b || '';
      const renderMD = text => typeof marked !== 'undefined' ? DOMPurify.sanitize(marked.parse(text)) : Utils.esc(text);
      taskHTML = `
        <div class="text-display-label">Prompt</div>
        <div class="text-display">${Utils.esc(item.prompt || item.text || '—')}</div>
        <div class="response-cols">
          <div class="response-card" id="rc-a">
            <div class="response-label a">Response A</div>
            <div class="response-text markdown-body">${renderMD(Pages._currentItemA)}</div>
          </div>
          <div class="response-card" id="rc-b">
            <div class="response-label b">Response B</div>
            <div class="response-text markdown-body">${renderMD(Pages._currentItemB)}</div>
          </div>
        </div>
        <div class="card-title" style="margin:16px 0 10px">Multi-Dimensional Evaluation</div>
        <div class="star-row"><span class="star-row-label">Instruction Following</span><div class="star-group" id="stars-instr">${Pages._stars('instr', existingAnn?.instr_score||0)}</div></div>
        <div class="star-row"><span class="star-row-label">Factuality</span><div class="star-group" id="stars-fact">${Pages._stars('fact', existingAnn?.fact_score||0)}</div></div>
        <div class="star-row"><span class="star-row-label">Formatting</span><div class="star-group" id="stars-form">${Pages._stars('form', existingAnn?.form_score||0)}</div></div>
        <div class="divider"></div>
        <div class="label-btn-grid" id="lbg">${labels.map((l,i)=>`
          <div class="label-btn ${labelColors[i%labelColors.length]} ${prevLabel===l?'selected':''}" data-label="${Utils.esc(l)}" onclick="Pages._selectLabel(this)">
            <span class="lbl-icon">${labelIcons[l]||'🏷️'}</span>${Utils.esc(l)}
          </div>`).join('')}</div>
          
        <div id="rc-rewrite-section" style="display:${prevLabel.includes('Response') ? 'block' : 'none'}; margin-top: 20px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:6px">Final Edited Response (Make slight edits to improve your chosen response)</div>
          <textarea class="form-textarea" id="ann-edited-response" placeholder="Edit the selected response here..." rows="8" style="font-family: monospace;">${Utils.esc(existingAnn?.edited_response || '')}</textarea>
        </div>`;
    } else if (proj.task_type === 'ai_evaluation') {
      taskHTML = `
        ${item.prompt ? `<div class="text-display-label">Prompt</div><div class="text-display">${Utils.esc(item.prompt)}</div>` : ''}
        <div class="text-display-label">AI Response</div>
        <div class="text-display" style="border-left:3px solid var(--accent)">${Utils.esc(item.ai_response || '—')}</div>
        <div class="label-btn-grid" id="lbg">${labels.map((l,i)=>`
          <div class="label-btn ${labelColors[i%labelColors.length]} ${prevLabel===l?'selected':''}" data-label="${Utils.esc(l)}" onclick="Pages._selectLabel(this)">
            <span class="lbl-icon">${labelIcons[l]||'🏷️'}</span>${Utils.esc(l)}
          </div>`).join('')}</div>
        <div class="card-title" style="margin:16px 0 10px">Multi-Dimensional Scores</div>
        <div class="star-row"><span class="star-row-label">Accuracy</span><div class="star-group" id="stars-acc">${Pages._stars('acc', existingAnn?.accuracy_score||0)}</div></div>
        <div class="star-row"><span class="star-row-label">Helpfulness</span><div class="star-group" id="stars-help">${Pages._stars('help', existingAnn?.helpfulness_score||0)}</div></div>
        <div class="star-row"><span class="star-row-label">Safety</span><div class="star-group" id="stars-safe">${Pages._stars('safe', existingAnn?.safety_score||0)}</div></div>
        <div class="star-row"><span class="star-row-label">Factuality</span>
          <div style="display:flex;gap:8px">${['Yes','Partial','No'].map(v=>`<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px">
            <input type="radio" name="fact" value="${v}" ${existingAnn?.factuality===v?'checked':''} /> ${v}</label>`).join('')}</div></div>`;
    } else {
      taskHTML = `
        <div class="text-display-label">${item.prompt ? 'Prompt' : 'Text'}</div>
        <div class="text-display">${Utils.esc(item.text || item.prompt || '—')}</div>
        ${item.ai_response ? `<div class="text-display-label">AI Response</div><div class="text-display" style="border-left:3px solid var(--accent)">${Utils.esc(item.ai_response)}</div>` : ''}
        <div class="label-btn-grid" id="lbg">${labels.map((l,i)=>`
          <div class="label-btn ${labelColors[i%labelColors.length]} ${prevLabel===l?'selected':''}" data-label="${Utils.esc(l)}" onclick="Pages._selectLabel(this)">
            <span class="lbl-icon">${labelIcons[l]||'🏷️'}</span>${Utils.esc(l)}
          </div>`).join('')}</div>`;
    }

    document.getElementById('main-content').innerHTML = `
      <div class="annotation-wrap">
        <div class="annotation-header">
          <span class="annotation-counter">Item ${myIAs.length - total + currentIdx + 1} · ${total} remaining</span>
          <span class="annotation-task-badge">${Utils.taskLabel(proj.task_type)}</span>
          ${timerHtml}
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('queue')">← Queue</button>
        </div>
        <div class="progress-label"><span>Overall Progress</span><span>${pct}%</span></div>
        <div class="progress-wrap" style="margin-bottom:18px"><div class="progress-bar" style="width:${pct}%"></div></div>
        <details class="instruction-panel" ${isReview ? 'open' : ''}>
          <summary>📋 Annotation Instructions${isReview ? ' · ⚠️ Re-annotation required' : ''}</summary>
          <div class="instruction-text">${Utils.esc(proj.instructions)}${isReview ? '\n\n⚠️ This item was rejected. Please re-read the instructions carefully before re-annotating.' : ''}</div>
        </details>
        <div class="card">${taskHTML}
          <div style="font-size:13px;font-weight:600;margin-top:20px;margin-bottom:6px">Comment (optional)</div>
          <textarea class="form-textarea" id="ann-comment" placeholder="Add notes or reasoning..." rows="2">${Utils.esc(prevComment)}</textarea>
          <div class="annotation-bar">
            <div style="font-size:12px;color:var(--text-2)">Confidence:</div>
            <div class="confidence-group">
              <div class="conf-btn ${existingAnn?.confidence_level==='high'?'active-high':''}" data-conf="high" onclick="Pages._setConf(this)">High</div>
              <div class="conf-btn ${existingAnn?.confidence_level==='medium'?'active-medium':''}" data-conf="medium" onclick="Pages._setConf(this)">Medium</div>
              <div class="conf-btn ${existingAnn?.confidence_level==='low'?'active-low':''}" data-conf="low" onclick="Pages._setConf(this)">Low</div>
            </div>
            <div class="spacer"></div>
            <button class="btn btn-ghost" onclick="Pages._skipItem('${iaId}')">Skip →</button>
            <button class="btn btn-primary btn-lg" onclick="Pages._submitAnnotation('${itemId}','${iaId}','${proj.project_id}','${proj.task_type}')">Submit ✓</button>
          </div>
        </div>
      </div>`;
  }
};

Pages._stars = (dim, val) => [1,2,3,4,5].map(n => `<span class="star ${n<=val?'lit':''}" data-dim="${dim}" data-val="${n}" onclick="Pages._setStar(this)">${n<=val?'★':'☆'}</span>`).join('');
Pages._setStar = el => {
  const dim = el.dataset.dim; const val = parseInt(el.dataset.val);
  document.querySelectorAll(`.star[data-dim="${dim}"]`).forEach((s,i) => { s.classList.toggle('lit', i < val); s.textContent = i < val ? '★' : '☆'; });
  el.closest('.star-group').dataset.val = val;
};
Pages._getStarVal = dim => parseInt(document.querySelector(`.star-group[id*="${dim}"]`)?.dataset?.val || document.querySelectorAll(`.star[data-dim="${dim}"].lit`).length || 0);
Pages._selectLabel = el => { 
  document.querySelectorAll('#lbg .label-btn').forEach(b => b.classList.remove('selected')); 
  el.classList.add('selected'); 
  
  const rwSec = document.getElementById('rc-rewrite-section');
  const rwText = document.getElementById('ann-edited-response');
  if (rwSec && rwText) {
    const lbl = el.dataset.label;
    if (lbl.includes('Response A') || lbl.includes('Response B')) {
      rwSec.style.display = 'block';
      if (!rwText.value.trim() || rwText.value === Pages._currentItemA || rwText.value === Pages._currentItemB) {
        rwText.value = lbl.includes('Response A') ? Pages._currentItemA : Pages._currentItemB;
      }
    } else {
      rwSec.style.display = 'none';
    }
  }
};
Pages._setConf = el => {
  document.querySelectorAll('.conf-btn').forEach(b => b.className = 'conf-btn');
  const conf = el.dataset.conf;
  el.classList.add(`active-${conf}`);
};

// ── NER / SPAN LOGIC ──────────────────────────────────────────
Pages._nerColor = i => ['#6366f1','#10b981','#f59e0b','#f43f5e','#a855f7','#06b6d4', '#ec4899', '#14b8a6', '#f97316'][i % 9];
Pages._nerEntities = [];
Pages._nerText = "";
Pages._selectedSpanIdx = -1;
Pages._activeNerLabel = "";

Pages._setNerActiveLabel = (lbl, i) => {
  Pages._activeNerLabel = lbl;
  document.querySelectorAll('#ner-legend .label-btn').forEach(b => b.classList.remove('selected'));
  const btn = document.getElementById(`ner-lbl-btn-${i}`);
  if (btn) btn.classList.add('selected');
};

Pages._getGlobalOffset = (node, offset, container) => {
  let currentOffset = 0;
  const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while (n = walk.nextNode()) {
    if (n === node) return currentOffset + offset;
    currentOffset += n.nodeValue.length;
  }
  return currentOffset;
};

Pages._nerSelect = () => {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const container = document.getElementById('ner-text');
  let start = Pages._getGlobalOffset(sel.anchorNode, sel.anchorOffset, container);
  let end = Pages._getGlobalOffset(sel.focusNode, sel.focusOffset, container);
  if (start > end) { const t = start; start = end; end = t; }
  
  if (Pages._nerEntities.some(e => Math.max(start, e.start) < Math.min(end, e.end))) {
    Toast.warning('Overlapping spans are not supported.');
    sel.removeAllRanges(); return;
  }
  
  const text = Pages._nerText.substring(start, end).trim();
  if (!text) { sel.removeAllRanges(); return; }
  
  const rawMatch = Pages._nerText.substring(start, end);
  const startLead = rawMatch.length - rawMatch.trimStart().length;
  start += startLead;
  end = start + text.length;

  Pages._nerEntities.push({ start, end, label: Pages._activeNerLabel, text });
  sel.removeAllRanges();
  Pages._renderNerText();
};

Pages._renderNerText = () => {
  Pages._nerEntities.sort((a,b) => a.start - b.start);
  let html = '';
  let lastIdx = 0;
  const container = document.getElementById('ner-text');
  if (!container) return;
  
  if (!document.getElementById('ner-mark-style')) {
      document.head.insertAdjacentHTML('beforeend', '<style id="ner-mark-style">.ner-mark::after { content: " [" attr(data-label) "]"; font-size: 10px; opacity: 0.8; font-weight: 600; pointer-events: none; }</style>');
  }

  Pages._nerEntities.forEach((ent, i) => {
      html += Utils.esc(Pages._nerText.substring(lastIdx, ent.start));
      const color = Pages._nerColor(Pages._activeLabelsList.indexOf(ent.label));
      const isSelected = i === Pages._selectedSpanIdx;
      html += `<mark class="ner-mark" data-label="${Utils.esc(ent.label)}" style="background:${color}33;color:${color};border-bottom:2px solid ${color};padding:0 2px;border-radius:2px;cursor:pointer;${isSelected?'box-shadow:0 0 0 2px '+color:''}" onclick="Pages._selectSpan(event, ${i})">${Utils.esc(ent.text)}</mark>`;
      lastIdx = ent.end;
  });
  html += Utils.esc(Pages._nerText.substring(lastIdx));
  container.innerHTML = html;
  Pages._renderNerList();
};

Pages._selectSpan = (e, i) => {
  e.stopPropagation();
  Pages._selectedSpanIdx = Pages._selectedSpanIdx === i ? -1 : i;
  Pages._renderNerText();
};

Pages._deleteSpan = i => {
  Pages._nerEntities.splice(i, 1);
  Pages._selectedSpanIdx = -1;
  Pages._renderNerText();
};

Pages._renderNerList = () => {
  const list = document.getElementById('ner-list');
  if (!list) return;
  list.innerHTML = Pages._nerEntities.length === 0 ? '<div style="color:var(--text-3);font-size:12px;margin-top:10px">No spans annotated yet.</div>' : 
    Pages._nerEntities.map((e, i) => {
      const color = Pages._nerColor(Pages._activeLabelsList.indexOf(e.label));
      const sel = i === Pages._selectedSpanIdx ? `box-shadow:0 0 0 2px ${color};` : '';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px;border:1px solid var(--border);border-left:4px solid ${color};border-radius:6px;background:var(--bg-base);cursor:pointer;${sel}" onclick="Pages._selectSpan(event, ${i})">
        <div style="flex:1;min-width:0;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;font-size:13px">${Utils.esc(e.text)}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="badge" style="background:${color}22;color:${color}">${Utils.esc(e.label)}</span>
          <span style="cursor:pointer;opacity:0.6;font-weight:bold" onclick="event.stopPropagation();Pages._deleteSpan(${i})">✕</span>
        </div>
      </div>`;
    }).join('');
};

Pages._nerKeyHandler = (e) => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if (e.key === 'z' && e.ctrlKey) {
    e.preventDefault();
    if (Pages._nerEntities.length > 0) { Pages._nerEntities.pop(); Pages._selectedSpanIdx = -1; Pages._renderNerText(); Toast.info('Last span undone.'); }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (Pages._selectedSpanIdx > -1) { Pages._deleteSpan(Pages._selectedSpanIdx); }
  }
  if (e.key === 'Enter') {
     e.preventDefault();
     Pages._triggerSubmit();
  }
  if (e.key >= '1' && e.key <= '9') {
     const idx = parseInt(e.key) - 1;
     if (idx < Pages._activeLabelsList.length) { Pages._setNerActiveLabel(Pages._activeLabelsList[idx], idx); }
  }
};

Pages._bindNerShortcuts = (itemId, iaId, projId, taskType) => {
  Pages._triggerSubmit = () => Pages._submitAnnotation(itemId, iaId, projId, taskType);
  document.addEventListener('keydown', Pages._nerKeyHandler);
};
Pages._unbindNerShortcuts = () => {
  document.removeEventListener('keydown', Pages._nerKeyHandler);
};

// ── GENERAL SUBMIT ────────────────────────────────────────────
Pages._skipItem = iaId => { Pages._unbindNerShortcuts(); DB.itemAssignments.update(iaId, { status: 'skipped' }); Toast.info('Item skipped.'); Router.navigate('queue'); };
Pages._submitAnnotation = (itemId, iaId, projId, taskType) => {
  Pages._unbindNerShortcuts();
  if (Pages._timerInterval) clearInterval(Pages._timerInterval);
  const u = Auth.currentUser;
  const selectedLabel = document.querySelector('#lbg .label-btn.selected')?.dataset?.label;
  const comment = document.getElementById('ann-comment')?.value.trim() || '';
  const confEl = document.querySelector('.conf-btn.active-high, .conf-btn.active-medium, .conf-btn.active-low');
  const confidence = confEl ? confEl.dataset.conf : 'medium';
  const isNer = taskType === 'ner';

  const editedRespEl = document.getElementById('ann-edited-response');
  const editedResponse = editedRespEl ? editedRespEl.value.trim() : null;

  if (taskType === 'response_comparison') {
      if (!selectedLabel) { Toast.error('Please select a winner before submitting.'); return; }
      if (comment.length < 10) { Toast.error('Please provide a justification (min 10 chars) for your choice.'); return; }
      if (editedRespEl && editedRespEl.parentElement.style.display !== 'none' && editedResponse.length === 0) {
          Toast.error('Please provide a final edited response.'); return;
      }
  } else {
      if (!isNer && !selectedLabel) { Toast.error('Please select a label before submitting.'); return; }
  }
  
  const timeTaken = Pages._activeTimerSeconds !== undefined ? Pages._activeTimerSeconds : Math.round((Date.now() - (Pages._annStartTime || Date.now())) / 1000);
  const existing = DB.annotations.byItemAndUser(itemId, u.user_id);
  const label = isNer ? (Pages._nerEntities.length + ' entit' + (Pages._nerEntities.length === 1 ? 'y' : 'ies') + ' tagged') : selectedLabel;
  
  const formattedSpans = Pages._nerEntities.map(e => ({ start: e.start, end: e.end, label: e.label, text: e.text }));
  
  const annData = {
    annotator_id: u.user_id, item_id: itemId, project_id: projId,
    annotator_label: label, annotator_comment: comment,
    confidence_level: confidence, time_taken_seconds: timeTaken,
    status: 'submitted', created_timestamp: Utils.now(), last_edited_timestamp: Utils.now(),
    ner_entities: isNer ? JSON.stringify(formattedSpans) : null,
    accuracy_score: Pages._getStarVal('acc'), helpfulness_score: Pages._getStarVal('help'), safety_score: Pages._getStarVal('safe'),
    factuality: document.querySelector('input[name="fact"]:checked')?.value || '',
    instr_score: Pages._getStarVal('instr'), fact_score: Pages._getStarVal('fact'), form_score: Pages._getStarVal('form'),
    edited_response: editedResponse
  };
  if (existing) {
    DB.history.create({ history_id: Utils.uuid(), annotation_id: existing.annotation_id, changed_by: u.user_id, old_label: existing.annotator_label, new_label: label, old_comment: existing.annotator_comment, new_comment: comment, change_type: existing.status === 're_annotation_required' ? 're_annotate' : 'edit', timestamp: Utils.now() });
    DB.annotations.update(existing.annotation_id, { ...annData, edit_count: (existing.edit_count || 0) + 1, original_label: existing.original_label || existing.annotator_label });
  } else {
    DB.annotations.create({ annotation_id: Utils.uuid(), edit_count: 0, original_label: label, ...annData });
  }
  DB.itemAssignments.update(iaId, { status: 'completed' });
  const myIAs = DB.itemAssignments.byUser(u.user_id);
  const nextPending = myIAs.find(x => { if (x.ia_id === iaId) return false; const a = DB.annotations.byItemAndUser(x.item_id, u.user_id); return !a || a.status === 'draft' || a.status === 're_annotation_required'; });
  Toast.success('Annotation submitted!');
  if (nextPending) { setTimeout(() => Router.navigate('annotate', { itemId: nextPending.item_id, iaId: nextPending.ia_id }), 400); }
  else { Toast.info("You've completed all pending items! 🎉"); setTimeout(() => Router.navigate('queue'), 600); }
};

// ── MY SUBMISSIONS ─────────────────────────────────────────────
Pages.submissions = function () {
  const u = Auth.currentUser;
  const myAnns = DB.annotations.byUser(u.user_id).sort((a,b) => new Date(b.last_edited_timestamp) - new Date(a.last_edited_timestamp));
  const rows = myAnns.map(ann => {
    const item = DB.items.get(ann.item_id) || {};
    const proj = DB.projects.get(ann.project_id) || {};
    const review = DB.reviews.byAnnotation(ann.annotation_id);
    const canEdit = ann.status === 'submitted';
    return `<tr>
      <td><div style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Utils.esc((item.text||item.prompt||'—').slice(0,80))}</div></td>
      <td><span class="badge badge-muted" style="font-size:10px">${Utils.esc(proj.project_name||'—')}</span></td>
      <td><strong>${Utils.esc(ann.annotator_label||'—')}</strong></td>
      <td><span class="badge ${Utils.badgeClass(ann.status)}">${Utils.statusLabel(ann.status)}</span></td>
      <td>${review ? `<span class="badge ${Utils.badgeClass(review.decision)}">${review.decision}</span>` : '—'}</td>
      <td>${review?.reviewer_comment ? `<span style="font-size:12px;color:var(--text-2)">${Utils.esc(review.reviewer_comment.slice(0,60))}</span>` : '—'}</td>
      <td>${Utils.formatDate(ann.last_edited_timestamp)}</td>
      <td>${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="Pages._recallAnnotation('${ann.annotation_id}','${ann.item_id}')">✏️ Edit</button>` : '<span style="color:var(--text-3);font-size:12px">Locked</span>'}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📝</div><div class="empty-msg">No submissions yet. Start annotating from your queue.</div><button class="btn btn-primary" onclick="Router.navigate('queue')">Go to Queue</button></div></td></tr>`;
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📝 My Submissions</div><div class="page-subtitle">${myAnns.length} total submissions</div></div>
    </div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Text</th><th>Project</th><th>My Label</th><th>Status</th><th>Review</th><th>Reviewer Comment</th><th>Date</th><th>Action</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
};
Pages._recallAnnotation = (annId, itemId) => {
  const ann = DB.annotations.get(annId);
  if (!ann || ann.status !== 'submitted') { Toast.error('This annotation cannot be edited.'); return; }
  const ia = DB.itemAssignments.byItem(itemId).find(x => x.assigned_to === Auth.currentUser.user_id);
  if (!ia) { Toast.error('Assignment not found.'); return; }
  Router.navigate('annotate', { itemId, iaId: ia.ia_id });
};
