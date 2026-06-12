'use strict';
// ============================================================
// PHASE 2 — Quality Control Pages
// IAA Analysis, Gold Standard, Conflict Queue, Annotator Performance
// ============================================================

// ── IAA HELPERS ───────────────────────────────────────────────
const IAA = {
  // Cohen's Kappa for 2 annotators
  cohensKappa(labels1, labels2, labelSet) {
    const n = labels1.length;
    if (n === 0) return null;
    const Po = labels1.filter((l, i) => l === labels2[i]).length / n;
    const Pe = labelSet.reduce((sum, l) => {
      const p1 = labels1.filter(x => x === l).length / n;
      const p2 = labels2.filter(x => x === l).length / n;
      return sum + p1 * p2;
    }, 0);
    if (Pe === 1) return 1;
    return parseFloat(((Po - Pe) / (1 - Pe)).toFixed(3));
  },
  // Fleiss' Kappa for 3+ annotators
  fleissKappa(itemsWithAnnotations, labelSet) {
    const N = itemsWithAnnotations.length;
    if (N === 0 || labelSet.length === 0) return null;
    let totalRatings = 0;
    const p = new Array(labelSet.length).fill(0);
    const P = new Array(N).fill(0);
    let validItems = 0;

    for (let i = 0; i < N; i++) {
      const anns = itemsWithAnnotations[i];
      const m = anns.length;
      if (m < 2) continue; // Skip items without multiple annotations
      validItems++;
      let sumMSquared = 0;
      for (let j = 0; j < labelSet.length; j++) {
        const count = anns.filter(a => a.annotator_label === labelSet[j]).length;
        p[j] += count;
        totalRatings += count;
        sumMSquared += count * count;
      }
      P[i] = (sumMSquared - m) / (m * (m - 1));
    }
    
    if (validItems === 0 || totalRatings === 0) return null;

    let Pe = 0;
    for (let j = 0; j < labelSet.length; j++) {
      const pj = p[j] / totalRatings;
      Pe += pj * pj;
    }
    const meanP = P.reduce((sum, val) => sum + val, 0) / validItems;
    if (Pe === 1) return 1;
    return parseFloat(((meanP - Pe) / (1 - Pe)).toFixed(3));
  },
  // Simple % agreement for any number of annotators
  pctAgreement(annsByItem) {
    let agreed = 0, total = 0;
    annsByItem.forEach(anns => {
      if (anns.length < 2) return;
      total++;
      const first = anns[0].annotator_label;
      if (anns.every(a => a.annotator_label === first)) agreed++;
    });
    return total === 0 ? null : Utils.pct(agreed, total);
  },
  // Majority label from a list of annotations
  majorityLabel(anns) {
    const counts = {};
    anns.forEach(a => { counts[a.annotator_label] = (counts[a.annotator_label] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  },
  kappaInterpret(k) {
    if (k === null) return { label: 'N/A', cls: 'badge-muted' };
    if (k < 0) return { label: 'Poor (<0)', cls: 'badge-danger' };
    if (k < 0.2) return { label: 'Slight (0–0.2)', cls: 'badge-danger' };
    if (k < 0.4) return { label: 'Fair (0.2–0.4)', cls: 'badge-warning' };
    if (k < 0.6) return { label: 'Moderate (0.4–0.6)', cls: 'badge-warning' };
    if (k < 0.8) return { label: 'Substantial (0.6–0.8)', cls: 'badge-success' };
    return { label: 'Almost Perfect (>0.8)', cls: 'badge-success' };
  },
};

// ── IAA ANALYSIS PAGE ────────────────────────────────────────
Pages.iaa = function () {
  const projects = DB.projects.all().filter(p => p.status === 'active' || p.status === 'completed');
  let html = '';

  projects.forEach(proj => {
    const items = DB.items.byProject(proj.project_id);
    const labelSet = proj.label_set || Utils.defaultLabels(proj.task_type);
    const annotators = DB.assignments.byProject(proj.project_id).filter(a => a.role === 'annotator').map(a => DB.users.get(a.user_id)).filter(Boolean);
    const annsByItem = items.map(item => DB.annotations.byItem(item.item_id).filter(a => a.status !== 'draft' && a.annotator_label));
    const multiAnnotated = annsByItem.filter(a => a.length >= 2);
    if (multiAnnotated.length === 0) {
      html += `<div class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title">📊 ${Utils.esc(proj.project_name)}</span>
          <span class="chip">${Utils.taskLabel(proj.task_type)}</span></div>
        <p style="color:var(--text-2);font-size:13px">Not enough multi-annotated items to calculate IAA yet. Assign at least 2 annotators to the same items.</p>
      </div>`;
      return;
    }
    const agreePct = IAA.pctAgreement(multiAnnotated);
    const conflicts = multiAnnotated.filter(anns => new Set(anns.map(a => a.annotator_label)).size > 1).length;

    // Cohen's Kappa between all annotator pairs
    let kappaRows = '';
    for (let i = 0; i < annotators.length; i++) {
      for (let j = i + 1; j < annotators.length; j++) {
        const a1 = annotators[i], a2 = annotators[j];
        const shared = items.filter(item => {
          const anns = DB.annotations.byItem(item.item_id).filter(a => a.status !== 'draft');
          return anns.some(a => a.annotator_id === a1.user_id) && anns.some(a => a.annotator_id === a2.user_id);
        });
        if (shared.length === 0) continue;
        const l1 = shared.map(item => DB.annotations.byItemAndUser(item.item_id, a1.user_id)?.annotator_label || '');
        const l2 = shared.map(item => DB.annotations.byItemAndUser(item.item_id, a2.user_id)?.annotator_label || '');
        const kappa = IAA.cohensKappa(l1, l2, labelSet);
        const interp = IAA.kappaInterpret(kappa);
        kappaRows += `<tr>
          <td>${Utils.esc(a1.full_name)}</td><td>${Utils.esc(a2.full_name)}</td>
          <td>${shared.length}</td>
          <td><strong>${kappa ?? 'N/A'}</strong></td>
          <td><span class="badge ${interp.cls}">${interp.label}</span></td>
        </tr>`;
      }
    }

    // Label distribution
    const allLabels = multiAnnotated.flat().map(a => a.annotator_label);
    const labelCounts = {};
    labelSet.forEach(l => labelCounts[l] = allLabels.filter(x => x === l).length);
    const maxCount = Math.max(...Object.values(labelCounts), 1);

    // Fleiss' Kappa for 3+ annotators overall
    let fleissHtml = '';
    if (annotators.length >= 3) {
      const fleissK = IAA.fleissKappa(multiAnnotated, labelSet);
      if (fleissK !== null) {
        const interp = IAA.kappaInterpret(fleissK);
        fleissHtml = `<div style="margin-bottom:16px;padding:12px;background:var(--bg-elevated);border-radius:var(--r-md);border:1px solid var(--border)">
          <div style="font-size:11px;font-weight:700;color:var(--text-3);margin-bottom:4px">FLEISS' KAPPA (Overall Multi-Rater Agreement)</div>
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:24px;font-weight:800">${fleissK}</span>
            <span class="badge ${interp.cls}">${interp.label}</span>
          </div>
        </div>`;
      }
    }

    html += `<div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <span class="card-title">📊 ${Utils.esc(proj.project_name)}</span>
        <div style="display:flex;gap:8px">
          <span class="badge badge-${agreePct >= 80 ? 'success' : agreePct >= 60 ? 'warning' : 'danger'}">${agreePct}% Agreement</span>
          <span class="badge badge-${conflicts > 0 ? 'danger' : 'success'}">${conflicts} Conflicts</span>
        </div>
      </div>
      ${fleissHtml}
      <div class="grid-2" style="gap:20px">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:10px">COHEN'S KAPPA (Annotator Pairs)</div>
          ${kappaRows ? `<div class="table-wrap"><table>
            <thead><tr><th>Annotator 1</th><th>Annotator 2</th><th>Items</th><th>κ Score</th><th>Interpretation</th></tr></thead>
            <tbody>${kappaRows}</tbody></table></div>` : '<p style="color:var(--text-2);font-size:13px">Need at least 2 annotators on same items.</p>'}
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:10px">LABEL DISTRIBUTION</div>
          ${Object.entries(labelCounts).map(([l, c]) => `
            <div style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
                <span>${Utils.esc(l)}</span><span style="color:var(--text-2)">${c}</span>
              </div>
              <div class="progress-wrap"><div class="progress-bar" style="width:${Utils.pct(c, maxCount)}%"></div></div>
            </div>`).join('')}
        </div>
      </div>
      <div style="margin-top:16px">
        <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:10px">ITEMS WITH DISAGREEMENT</div>
        ${multiAnnotated.filter(anns => new Set(anns.map(a=>a.annotator_label)).size > 1).slice(0,5).map(anns => {
          const item = DB.items.get(anns[0]?.item_id) || {};
          const majority = IAA.majorityLabel(anns);
          return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
            <span style="flex:1;color:var(--text-2)">${Utils.esc((item.text||item.prompt||'—').slice(0,80))}</span>
            ${anns.map(a => { const u = DB.users.get(a.annotator_id); return `<span class="badge badge-muted" title="${Utils.esc(u?.full_name||'')}">${Utils.esc(a.annotator_label)}</span>`; }).join('')}
            <span class="badge badge-primary">Majority: ${Utils.esc(majority||'—')}</span>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('conflicts')">⚖️ Resolve</button>
          </div>`;
        }).join('') || '<p style="color:var(--text-2);font-size:13px">No disagreements — excellent consistency!</p>'}
      </div>
    </div>`;
  });

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">🤝 Inter-Annotator Agreement (IAA)</div>
        <div class="page-subtitle">Cohen's Kappa, agreement rates and label distribution across your annotation projects</div></div>
    </div>
    ${html || '<div class="empty-state"><div class="empty-icon">🤝</div><div class="empty-title">No active projects</div><div class="empty-msg">Create a project and start annotating to see IAA scores.</div></div>'}`;
};

// ── GOLD STANDARD PAGE ────────────────────────────────────────
Pages.goldStandard = function () {
  const projects = DB.projects.all();
  const selProjId = Router.params?.projId || projects[0]?.project_id || '';

  const renderProject = pid => {
    const proj = DB.projects.get(pid);
    if (!proj) return '';
    const items = DB.items.byProject(pid);
    const goldItems = items.filter(i => i.is_gold_standard);
    const annotators = DB.users.byRole('annotator');

    // Score table: for each annotator, how many gold items they got right
    const scoreTable = annotators.map(u => {
      const tested = goldItems.filter(item => {
        const ann = DB.annotations.byItemAndUser(item.item_id, u.user_id);
        return ann && ann.status !== 'draft';
      });
      const correct = tested.filter(item => {
        const ann = DB.annotations.byItemAndUser(item.item_id, u.user_id);
        return ann?.annotator_label === item.gold_standard_label;
      });
      return { user: u, tested: tested.length, correct: correct.length, pct: Utils.pct(correct.length, tested.length) };
    }).filter(r => r.tested > 0);

    return `
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title">🏆 ${Utils.esc(proj.project_name)}</span>
          <span class="badge badge-muted">${goldItems.length} gold items</span>
        </div>
        <div class="grid-2">
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:10px">GOLD STANDARD ITEMS</div>
            ${items.slice(0, 15).map(item => `
              <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px">
                <input type="checkbox" ${item.is_gold_standard ? 'checked' : ''} onchange="Pages._toggleGold('${item.item_id}',this.checked)" style="width:15px;height:15px;cursor:pointer" />
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-2)">${Utils.esc((item.text||item.prompt||'—').slice(0,70))}</span>
                ${item.is_gold_standard ? `
                  <select class="form-select" style="width:140px;font-size:11px;padding:3px 6px" onchange="Pages._setGoldLabel('${item.item_id}',this.value)">
                    <option value="">Set correct label</option>
                    ${(proj.label_set||[]).map(l => `<option value="${Utils.esc(l)}" ${item.gold_standard_label===l?'selected':''}>${Utils.esc(l)}</option>`).join('')}
                  </select>` : ''}
              </div>`).join('')}
            ${items.length > 15 ? `<div style="font-size:11px;color:var(--text-3);margin-top:6px">...and ${items.length-15} more items</div>` : ''}
          </div>
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:10px">ANNOTATOR SCORES ON GOLD ITEMS</div>
            ${scoreTable.length === 0 ? '<p style="color:var(--text-2);font-size:13px">No annotators have submitted annotations on gold items yet.</p>' :
              `<div class="table-wrap"><table>
                <thead><tr><th>Annotator</th><th>Tested</th><th>Correct</th><th>Score</th></tr></thead>
                <tbody>${scoreTable.map(r => `<tr>
                  <td><div style="display:flex;align-items:center;gap:8px"><div class="avatar-sm">${Utils.initials(r.user.full_name)}</div>${Utils.esc(r.user.full_name)}</div></td>
                  <td>${r.tested}</td><td>${r.correct}</td>
                  <td><span class="badge ${r.pct>=80?'badge-success':r.pct>=60?'badge-warning':'badge-danger'}">${r.pct}%</span></td>
                </tr>`).join('')}</tbody>
              </table></div>`}
          </div>
        </div>
      </div>`;
  };

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">🏆 Gold Standard Items</div>
        <div class="page-subtitle">Mark items with known correct answers to silently test annotator quality</div></div>
    </div>
    <div class="form-group" style="max-width:360px;margin-bottom:20px">
      <label>Select Project</label>
      <select class="form-select" onchange="Router.params.projId=this.value;Pages.goldStandard()">
        ${projects.map(p => `<option value="${p.project_id}" ${p.project_id===selProjId?'selected':''}>${Utils.esc(p.project_name)}</option>`).join('')}
      </select>
    </div>
    ${selProjId ? renderProject(selProjId) : '<div class="empty-state"><div class="empty-icon">📁</div><div class="empty-msg">No projects found.</div></div>'}`;
};
Pages._toggleGold = (itemId, checked) => {
  DB.items.update(itemId, { is_gold_standard: checked, gold_standard_label: checked ? '' : '' });
  Toast.success(checked ? 'Item marked as Gold Standard.' : 'Gold Standard removed.');
};
Pages._setGoldLabel = (itemId, label) => {
  DB.items.update(itemId, { gold_standard_label: label });
  Toast.success('Correct label set.');
};

// ── CONFLICT QUEUE ────────────────────────────────────────────
Pages.conflicts = function () {
  const allItems = DB.items.all();
  const conflicts = [];
  allItems.forEach(item => {
    const anns = DB.annotations.byItem(item.item_id).filter(a => a.status !== 'draft' && a.annotator_label);
    if (anns.length < 2) return;
    const labels = new Set(anns.map(a => a.annotator_label));
    if (labels.size > 1) {
      const proj = DB.projects.get(item.project_id);
      conflicts.push({ item, anns, proj, majority: IAA.majorityLabel(anns) });
    }
  });
  const resolved = conflicts.filter(c => c.item.consensus_label);
  const pending = conflicts.filter(c => !c.item.consensus_label);

  const renderConflict = ({ item, anns, proj, majority }, showResolve) => `
    <div class="card card-sm" style="margin-bottom:12px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${Utils.esc(proj?.project_name||'—')} · ${Utils.taskLabel(proj?.task_type||'')}</div>
          <div style="font-size:14px;color:var(--text-1);line-height:1.5">${Utils.esc((item.text||item.prompt||'—').slice(0,160))}</div>
        </div>
        <div style="flex-shrink:0">
          <div style="font-size:11px;color:var(--text-3);margin-bottom:6px">ANNOTATIONS</div>
          ${anns.map(a => { const u = DB.users.get(a.annotator_id); return `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:12px">
              <div class="avatar-sm">${Utils.initials(u?.full_name||'?')}</div>
              <span style="color:var(--text-2)">${Utils.esc(u?.full_name||'—')}</span>
              <span class="badge badge-primary">${Utils.esc(a.annotator_label)}</span>
            </div>`; }).join('')}
          <div style="margin-top:8px;font-size:12px;color:var(--text-2)">Majority: <strong>${Utils.esc(majority||'—')}</strong></div>
          ${item.consensus_label ? `<div style="margin-top:4px"><span class="badge badge-success">✅ Resolved: ${Utils.esc(item.consensus_label)}</span></div>` : ''}
        </div>
      </div>
      ${showResolve ? `
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-size:12px;color:var(--text-2)">Set final label:</span>
          ${(proj?.label_set||Utils.defaultLabels(proj?.task_type||'')).map(l => `
            <button class="btn btn-ghost btn-sm ${item.consensus_label===l?'btn-primary':''}" onclick="Pages._resolveConflict('${item.item_id}','${Utils.esc(l)}')">
              ${Utils.esc(l)}
            </button>`).join('')}
          <button class="btn btn-secondary btn-sm" onclick="Pages._resolveConflict('${item.item_id}','${Utils.esc(majority||'')}')">
            Use Majority (${Utils.esc(majority||'—')})
          </button>
        </div>` : ''}
    </div>`;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">⚖️ Conflict Queue</div>
        <div class="page-subtitle">${pending.length} unresolved conflicts · ${resolved.length} resolved</div></div>
      ${pending.length > 0 ? `<button class="btn btn-secondary" onclick="Pages._resolveAllMajority()">Auto-resolve All by Majority</button>` : ''}
    </div>
    <div class="tabs">
      <div class="tab active" id="ct-pend" onclick="Pages._cTab('pend')">⏳ Unresolved (${pending.length})</div>
      <div class="tab" id="ct-done" onclick="Pages._cTab('done')">✅ Resolved (${resolved.length})</div>
    </div>
    <div id="ct-pend-body">${pending.length ? pending.map(c => renderConflict(c, true)).join('') :
      '<div class="empty-state"><div class="empty-icon">⚖️</div><div class="empty-title">No conflicts</div><div class="empty-msg">All annotated items are in agreement.</div></div>'}
    </div>
    <div id="ct-done-body" class="hidden">${resolved.length ? resolved.map(c => renderConflict(c, false)).join('') :
      '<div class="empty-state" style="padding:40px"><div class="empty-msg">No resolved conflicts yet.</div></div>'}
    </div>`;
};
Pages._cTab = t => {
  ['pend','done'].forEach(id => {
    document.getElementById(`ct-${id}`)?.classList.toggle('active', id === t);
    document.getElementById(`ct-${id}-body`)?.classList.toggle('hidden', id !== t);
  });
};
Pages._resolveConflict = (itemId, label) => {
  if (!label) { Toast.error('Please select a label.'); return; }
  DB.items.update(itemId, { consensus_label: label });
  const anns = DB.annotations.byItem(itemId);
  anns.forEach(a => { if (a.status !== 'draft') DB.annotations.update(a.annotation_id, { status: 'review_complete' }); });
  Toast.success(`Conflict resolved: "${label}"`);
  Pages.conflicts();
};
Pages._resolveAllMajority = () => {
  Modal.confirm('Auto-resolve All Conflicts', 'Set the majority label as the final label for all unresolved conflicts?', () => {
    const allItems = DB.items.all();
    let count = 0;
    allItems.forEach(item => {
      if (item.consensus_label) return;
      const anns = DB.annotations.byItem(item.item_id).filter(a => a.status !== 'draft' && a.annotator_label);
      if (anns.length < 2) return;
      const labels = new Set(anns.map(a => a.annotator_label));
      if (labels.size > 1) { DB.items.update(item.item_id, { consensus_label: IAA.majorityLabel(anns) }); count++; }
    });
    Toast.success(`${count} conflicts resolved by majority vote.`);
    Pages.conflicts();
  });
};

// ── ANNOTATOR PERFORMANCE ─────────────────────────────────────
Pages.performance = function () {
  const annotators = DB.users.byRole('annotator');
  const rows = annotators.map(u => {
    const anns = DB.annotations.byUser(u.user_id).filter(a => a.status !== 'draft');
    const reviews = DB.reviews.all().filter(r => anns.some(a => a.annotation_id === r.annotation_id));
    const accepted = reviews.filter(r => r.decision === 'accepted').length;
    const rejected = reviews.filter(r => r.decision === 'rejected').length;
    const agreePct = Utils.pct(accepted, reviews.length);
    const avgTime = anns.length ? Math.round(anns.reduce((s, a) => s + (a.time_taken_seconds || 0), 0) / anns.length) : 0;
    const goldItems = DB.items.all().filter(i => i.is_gold_standard && i.gold_standard_label);
    const goldTested = goldItems.filter(item => DB.annotations.byItemAndUser(item.item_id, u.user_id)?.annotator_label);
    const goldCorrect = goldTested.filter(item => DB.annotations.byItemAndUser(item.item_id, u.user_id)?.annotator_label === item.gold_standard_label);
    const goldScore = goldTested.length ? Utils.pct(goldCorrect.length, goldTested.length) : null;
    const assignments = DB.itemAssignments.byUser(u.user_id);
    const pending = assignments.filter(ia => { const a = DB.annotations.byItemAndUser(ia.item_id, u.user_id); return !a || a.status === 'draft'; }).length;

    // Quality flag: fast submissions (< 5 seconds average)
    const tooFast = avgTime > 0 && avgTime < 5 && anns.length > 3;

    return { u, anns, reviews, accepted, rejected, agreePct, avgTime, goldScore, goldTested: goldTested.length, pending, tooFast };
  });

  const tableRows = rows.map(r => `<tr>
    <td><div style="display:flex;align-items:center;gap:10px">
      <div class="avatar-sm">${Utils.initials(r.u.full_name)}</div>
      <div><div style="font-weight:600">${Utils.esc(r.u.full_name)}</div>
        <div style="font-size:11px;color:var(--text-3)">${Utils.esc(r.u.username)}</div></div>
    </div></td>
    <td>${r.anns.length}</td>
    <td>${r.pending}</td>
    <td>${r.reviews.length ? `<span class="badge ${r.agreePct>=80?'badge-success':r.agreePct>=60?'badge-warning':'badge-danger'}">${r.agreePct}%</span>` : '—'}</td>
    <td>${r.accepted} ✅ / ${r.rejected} ❌</td>
    <td>${r.goldScore !== null ? `<span class="badge ${r.goldScore>=80?'badge-success':r.goldScore>=60?'badge-warning':'badge-danger'}">${r.goldScore}% (${r.goldTested} tested)</span>` : '—'}</td>
    <td>${r.avgTime ? `${r.avgTime}s avg` : '—'}</td>
    <td>${r.tooFast ? '<span class="badge badge-danger">⚡ Too Fast</span>' : '<span class="badge badge-success">✅ Normal</span>'}</td>
  </tr>`).join('') || `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-msg">No annotators found.</div></div></td></tr>`;

  // Summary stats
  const totalSubmissions = rows.reduce((s, r) => s + r.anns.length, 0);
  const avgAgreement = rows.filter(r => r.reviews.length).length ? Math.round(rows.filter(r => r.reviews.length).reduce((s, r) => s + r.agreePct, 0) / rows.filter(r => r.reviews.length).length) : 0;
  const flagged = rows.filter(r => r.tooFast).length;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📈 Annotator Performance</div>
        <div class="page-subtitle">Speed, accuracy, agreement rate and gold standard scores per annotator</div></div>
    </div>
    <div class="stat-grid" style="margin-bottom:24px">
      <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-value" style="color:var(--primary)">${annotators.length}</div><div class="stat-label">Annotators</div></div>
      <div class="stat-card"><div class="stat-icon">✏️</div><div class="stat-value" style="color:var(--accent)">${totalSubmissions}</div><div class="stat-label">Total Submissions</div></div>
      <div class="stat-card"><div class="stat-icon">🤝</div><div class="stat-value" style="color:var(--success)">${avgAgreement}%</div><div class="stat-label">Avg Agreement Rate</div></div>
      <div class="stat-card"><div class="stat-icon">⚡</div><div class="stat-value" style="color:${flagged>0?'var(--danger)':'var(--success)'}">${flagged}</div><div class="stat-label">Anomaly Flags</div></div>
    </div>
    ${flagged > 0 ? `<div style="background:var(--warning-bg);border:1px solid rgba(245,158,11,0.3);border-radius:var(--r-lg);padding:14px 18px;margin-bottom:16px;font-size:13px;color:var(--warning)">
      ⚡ <strong>${flagged} annotator${flagged>1?'s':''} flagged</strong> for submitting annotations unusually fast (avg < 5 seconds). Review their work quality carefully.
    </div>` : ''}
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>Annotator</th><th>Submitted</th><th>Pending</th><th>Agreement Rate</th><th>Accept / Reject</th><th>Gold Standard</th><th>Avg Time</th><th>Status</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table></div>
    </div>
    ${rows.length > 0 ? `<div class="card" style="margin-top:16px">
      <div class="card-header"><span class="card-title">📊 Per-Annotator Breakdown</span></div>
      ${rows.map(r => `
        <div style="padding:14px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div class="avatar-sm">${Utils.initials(r.u.full_name)}</div>
            <strong>${Utils.esc(r.u.full_name)}</strong>
            ${r.tooFast ? '<span class="badge badge-danger">⚡ Anomaly</span>' : ''}
          </div>
          <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:12px;color:var(--text-2)">
            <span>📝 ${r.anns.length} submitted</span>
            <span>✅ ${r.accepted} accepted</span>
            <span>❌ ${r.rejected} rejected</span>
            <span>⏰ ${r.avgTime}s avg/item</span>
            ${r.goldScore !== null ? `<span>🏆 Gold: ${r.goldScore}%</span>` : ''}
          </div>
          ${r.anns.length > 0 ? `<div style="margin-top:8px">
            <div class="progress-wrap"><div class="progress-bar" style="width:${r.agreePct}%"></div></div>
          </div>` : ''}
        </div>`).join('')}
    </div>` : ''}`;
};
