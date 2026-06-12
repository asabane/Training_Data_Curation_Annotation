'use strict';
// ============================================================
// PAGES — Review Queue & Review Screen
// ============================================================

Pages.reviewQueue = function () {
  const u = Auth.currentUser;
  const submittedAnns = DB.annotations.all().filter(a => a.status === 'submitted');
  const myReviewed = DB.reviews.byReviewer(u.user_id);
  const reviewedAnnIds = new Set(myReviewed.map(r => r.annotation_id));
  const pending = submittedAnns.filter(a => !reviewedAnnIds.has(a.annotation_id) && a.annotator_id !== u.user_id);
  const renderPending = !pending.length
    ? `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Review Queue Empty</div><div class="empty-msg">No submissions awaiting review at this time.</div></div>`
    : pending.map(ann => {
        const item = DB.items.get(ann.item_id) || {};
        const proj = DB.projects.get(ann.project_id) || {};
        const annotator = DB.users.get(ann.annotator_id) || {};
        const s = DB.settings.get();
        return `<div class="queue-item" onclick="Router.navigate('review',{annotationId:'${ann.annotation_id}'})">
          <span style="font-size:20px">🔍</span>
          <div style="flex:1;min-width:0">
            <div class="queue-item-text">${Utils.esc((item.text||item.prompt||'—').slice(0,100))}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:3px">
              ${s.blind_review ? '👤 Anonymous' : Utils.esc(annotator.full_name||'—')} · ${Utils.esc(proj.project_name||'—')}
            </div>
          </div>
          <div class="queue-item-meta">
            <span class="badge badge-primary">${Utils.esc(ann.annotator_label)}</span>
            <span class="badge badge-muted">${Utils.taskLabel(proj.task_type||'')}</span>
            <span style="font-size:11px;color:var(--text-3)">${Utils.timeAgo(ann.created_timestamp)}</span>
          </div></div>`;
      }).join('');

  const renderDone = !myReviewed.length
    ? `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-msg">No completed reviews yet.</div></div>`
    : myReviewed.slice(0,20).map(rev => {
        const ann = DB.annotations.get(rev.annotation_id) || {};
        const item = DB.items.get(ann.item_id) || {};
        const proj = DB.projects.get(ann.project_id) || {};
        return `<div class="queue-item" onclick="Router.navigate('review',{annotationId:'${ann.annotation_id}'})" title="Click to view or edit this review">
          <span style="font-size:20px">${rev.decision==='accepted'?'✅':rev.decision==='rejected'?'❌':'✏️'}</span>
          <div style="flex:1;min-width:0"><div class="queue-item-text">${Utils.esc((item.text||item.prompt||'—').slice(0,100))}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:3px">${Utils.esc(proj.project_name||'—')}</div></div>
          <div class="queue-item-meta">
            <span class="badge ${Utils.badgeClass(rev.decision)}">${rev.decision}</span>
            <span class="badge badge-muted">${Utils.esc(rev.final_label||'—')}</span>
            <span style="font-size:11px;color:var(--text-3)">${Utils.timeAgo(rev.review_timestamp)}</span>
          </div></div>`;
      }).join('');

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">🔍 Review Queue</div>
        <div class="page-subtitle">${pending.length} pending · ${myReviewed.length} reviewed by you</div></div>
    </div>
    <div class="tabs">
      <div class="tab active" id="rtab-pend" onclick="Pages._rTab('pend')">⏳ Pending Review (${pending.length})</div>
      <div class="tab" id="rtab-done" onclick="Pages._rTab('done')">✅ Completed (${myReviewed.length})</div>
    </div>
    <div id="rtab-pend-body">${renderPending}</div>
    <div id="rtab-done-body" class="hidden">${renderDone}</div>`;
  
  if (pending.length === 0 && myReviewed.length > 0) {
    setTimeout(() => Pages._rTab('done'), 10);
  }
};
Pages._rTab = t => {
  ['pend','done'].forEach(id => {
    document.getElementById(`rtab-${id}`)?.classList.toggle('active', id === t);
    document.getElementById(`rtab-${id}-body`)?.classList.toggle('hidden', id !== t);
  });
};

// ── REVIEW SCREEN ─────────────────────────────────────────────
Pages.review = function (annotationId) {
  const u = Auth.currentUser;
  const ann = DB.annotations.get(annotationId);
  if (!ann) { Toast.error('Annotation not found.'); Router.navigate('review-queue'); return; }
  if (ann.annotator_id === u.user_id) { Toast.error("You can't review your own annotation."); Router.navigate('review-queue'); return; }
  const item = DB.items.get(ann.item_id) || {};
  const proj = DB.projects.get(ann.project_id) || {};
  const annotator = DB.users.get(ann.annotator_id) || {};
  const s = DB.settings.get();
  const isBlind = s.blind_review;
  const labels = proj.label_set?.length ? proj.label_set : Utils.defaultLabels(proj.task_type);
  const existingReview = DB.reviews.byAnnotation(annotationId);

  const nerEntities = ann.ner_entities ? JSON.parse(ann.ner_entities) : null;
  const labelColors = ['v-green','v-red','v-yellow','v-purple','v-cyan','v-orange'];

  let contentHTML = '';
  if (proj.task_type === 'response_comparison') {
    contentHTML = `
      <div class="text-display-label">Prompt</div><div class="text-display">${Utils.esc(item.prompt||item.text||'—')}</div>
      <div class="response-cols">
        <div class="response-card"><div class="response-label a">Response A</div><div class="response-text">${Utils.esc(item.response_a||'—')}</div></div>
        <div class="response-card"><div class="response-label b">Response B</div><div class="response-text">${Utils.esc(item.response_b||'—')}</div></div>
      </div>`;
  } else if (proj.task_type === 'ai_evaluation') {
    contentHTML = `
      ${item.prompt ? `<div class="text-display-label">Prompt</div><div class="text-display">${Utils.esc(item.prompt)}</div>` : ''}
      <div class="text-display-label">AI Response</div>
      <div class="text-display" style="border-left:3px solid var(--accent)">${Utils.esc(item.ai_response||'—')}</div>
      ${ann.accuracy_score ? `<div style="font-size:12px;color:var(--text-2);margin-top:8px">Annotator scores — Accuracy: ${ann.accuracy_score}/5 · Helpfulness: ${ann.helpfulness_score}/5 · Safety: ${ann.safety_score}/5 · Factuality: ${ann.factuality||'—'}</div>` : ''}`;
  } else if (proj.task_type === 'ner' && nerEntities) {
    contentHTML = `<div class="text-display-label">Text</div><div class="text-display">${Utils.esc(item.text||'—')}</div>
      <div style="margin-top:10px;font-size:13px;font-weight:600;margin-bottom:6px">Tagged Entities:</div>
      <div class="ner-entities-list">${nerEntities.map((e,i)=>`<span class="ner-chip" style="background:${Pages._nerColor(i)}22;border:1px solid ${Pages._nerColor(i)}">${Utils.esc(e.text)} <span style="font-size:10px;opacity:0.7">${Utils.esc(e.label)}</span></span>`).join('')}</div>`;
  } else {
    contentHTML = `<div class="text-display-label">${item.prompt ? 'Prompt' : 'Text'}</div>
      <div class="text-display">${Utils.esc(item.text||item.prompt||'—')}</div>
      ${item.ai_response ? `<div class="text-display-label">AI Response</div><div class="text-display" style="border-left:3px solid var(--accent)">${Utils.esc(item.ai_response)}</div>` : ''}`;
  }

  if (proj.task_type === 'ner') {
    Pages._nerEntities = existingReview?.reviewer_spans ? JSON.parse(existingReview.reviewer_spans) : (nerEntities || []);
    Pages._nerText = item.text || item.prompt || '';
    Pages._selectedSpanIdx = -1;
    Pages._activeLabelsList = labels;
    
    document.getElementById('main-content').innerHTML = `
      <div class="page-header" style="margin-bottom:16px">
        <div><div class="page-title">🔍 Review Span Annotation</div>
        <div class="page-subtitle">Project: ${Utils.esc(proj.project_name||'—')}</div></div>
        <button class="btn btn-ghost btn-sm" onclick="Pages._unbindNerShortcuts && Pages._unbindNerShortcuts(); Router.navigate('review-queue')">← Queue</button>
      </div>
      <div style="display:flex;gap:20px;align-items:stretch;height:calc(100vh - 120px)" id="ner-layout-container">
        <!-- CENTER: Workspace -->
        <div style="flex:2.5;background:var(--bg-elevated);padding:25px;border-radius:var(--r-md);display:flex;flex-direction:column;border:1px solid var(--border)">
          <div style="margin-bottom:15px;display:flex;justify-content:space-between;align-items:center">
             <div class="card-title">Review & Edit Spans</div>
          </div>
          
          <div style="font-size:12px;color:var(--text-3);margin-bottom:12px;background:var(--bg-base);padding:10px;border-radius:6px">
            <strong>Annotator:</strong> <span class="${isBlind?'blind-mask':''}">${Utils.esc(annotator.full_name||'—')}</span> · 
            <strong>Original Tags:</strong> ${nerEntities?nerEntities.length:0} 
            ${ann.annotator_comment ? `· <strong>Comment:</strong> ${Utils.esc(ann.annotator_comment)}` : ''}
          </div>
          
          <div style="font-size:12px;color:var(--text-3);margin-bottom:6px">Select Label (Keyboard 1-${labels.length}):</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:15px" id="ner-legend">
            ${labels.map((l,i)=>`<div class="label-btn" style="padding:4px 8px;font-size:14px;border:1px solid ${Pages._nerColor(i)};border-bottom:3px solid ${Pages._nerColor(i)}" id="ner-lbl-btn-${i}" onclick="Pages._setNerActiveLabel('${Utils.esc(l)}', ${i})"><span style="margin-right:6px;opacity:0.5">${i+1}.</span>${Utils.esc(l)}</div>`).join('')}
          </div>

          <div style="font-size:12px;color:var(--text-3);border-top:1px solid var(--border);padding-top:15px;margin-bottom:10px">Highlight text below to create a span:</div>
          <div class="text-display ner-workspace-text" id="ner-text" onmouseup="Pages._nerSelect && Pages._nerSelect()" style="font-size:16px;line-height:2;min-height:300px;background:none;border:none;white-space:pre-wrap"></div>
        </div>

        <!-- RIGHT: Decision -->
        <div style="flex:1;background:var(--bg-elevated);padding:20px;border-radius:var(--r-md);display:flex;flex-direction:column;border:1px solid var(--border)">
          <div class="card-title" style="margin-bottom:10px">Annotated Spans</div>
          <div id="ner-list" style="flex:1;overflow-y:auto;margin-bottom:20px;display:flex;flex-direction:column;gap:8px"></div>
          
          <textarea class="form-textarea" id="rev-comment" placeholder="Reviewer comment / feedback..." rows="2" style="margin-bottom:12px">${Utils.esc(existingReview?.reviewer_comment||'')}</textarea>
          
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-success" onclick="Pages._submitReview('${annotationId}','accepted')">✅ Accept</button>
            <button class="btn btn-warning" onclick="Pages._submitReview('${annotationId}','modified')">✏️ Modify</button>
            <button class="btn btn-danger" onclick="Pages._submitReview('${annotationId}','rejected')">❌ Reject</button>
          </div>
        </div>
      </div>`;
      
      if (Pages._setNerActiveLabel) {
        Pages._setNerActiveLabel(labels[0], 0);
        Pages._renderNerText();
        Pages._bindNerShortcuts(ann.item_id, null, proj.project_id, 'ner');
        // Override the Enter submit hook for Review
        Pages._triggerSubmit = () => Pages._submitReview(annotationId, 'accepted'); 
      }

  } else {
    document.getElementById('main-content').innerHTML = `
      <div class="page-header">
        <div><div class="page-title">🔍 Review Item</div><div class="page-subtitle">Project: ${Utils.esc(proj.project_name||'—')}</div></div>
        <button class="btn btn-ghost" onclick="Router.navigate('review-queue')">← Queue</button>
      </div>
      <details class="instruction-panel" style="margin-bottom:16px">
        <summary>📋 Annotation Instructions</summary>
        <div class="instruction-text">${Utils.esc(proj.instructions||'')}</div>
      </details>
      <div class="review-comparison">
        <div class="review-col">
          <div class="review-col-header">📄 Original Content</div>
          <div class="card card-sm">${contentHTML}</div>
        </div>
        <div class="review-col">
          <div class="review-col-header">👤 Annotator Submission</div>
          <div class="card card-sm">
            <div style="margin-bottom:12px">
              <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">ANNOTATOR</div>
              <div class="${isBlind ? 'blind-mask' : ''}" title="${isBlind ? 'Click to reveal' : ''}">${Utils.esc(annotator.full_name||'—')}</div>
            </div>
            <div style="margin-bottom:12px">
              <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">ANNOTATOR LABEL</div>
              <div class="annotator-label-display">${Utils.esc(ann.annotator_label||'—')}</div>
            </div>
            ${ann.annotator_comment ? `<div><div style="font-size:11px;color:var(--text-3);margin-bottom:4px">COMMENT</div><div style="font-size:13px;color:var(--text-2)">${Utils.esc(ann.annotator_comment)}</div></div>` : ''}
            ${ann.confidence_level ? `<div style="margin-top:10px"><span class="badge ${ann.confidence_level==='high'?'badge-success':ann.confidence_level==='low'?'badge-danger':'badge-warning'}">${ann.confidence_level} confidence</span></div>` : ''}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">📝 Your Review Decision</span></div>
        <div class="form-group"><label>Reviewer Label (override or accept as-is)</label>
          <div class="label-btn-grid">${labels.map((l,i)=>`
            <div class="label-btn ${labelColors[i%labelColors.length]} ${(existingReview?.reviewer_label||ann.annotator_label)===l?'selected':''}" data-label="${Utils.esc(l)}" onclick="Pages._selectLabel(this)">
              ${Utils.esc(l)}
            </div>`).join('')}</div>
        </div>
        <div class="form-group"><label>Reviewer Comment</label>
          <textarea class="form-textarea" id="rev-comment" placeholder="Add reasoning, corrections, or feedback for the annotator..." rows="3">${Utils.esc(existingReview?.reviewer_comment||'')}</textarea>
        </div>
        <div class="annotation-bar">
          <div class="spacer"></div>
          <button class="btn btn-success" onclick="Pages._submitReview('${annotationId}','accepted')">✅ Accept</button>
          <button class="btn btn-warning" onclick="Pages._submitReview('${annotationId}','modified')">✏️ Modify</button>
          <button class="btn btn-danger" onclick="Pages._submitReview('${annotationId}','rejected')">❌ Reject</button>
        </div>
      </div>`;
  }
};

Pages._submitReview = (annotationId, decision) => {
  const u = Auth.currentUser;
  const ann = DB.annotations.get(annotationId);
  if (!ann) return;
  if (Pages._unbindNerShortcuts) Pages._unbindNerShortcuts();
  const selectedLabel = document.querySelector('#lbg .label-btn.selected, .label-btn-grid .label-btn.selected')?.dataset?.label || ann.annotator_label;
  const comment = document.getElementById('rev-comment')?.value.trim() || '';
  if (decision === 'rejected' && !comment) { Toast.error('Please add a comment explaining why you rejected this annotation.'); return; }
  
  const proj = DB.projects.get(ann.project_id) || {};
  let finalLabel = decision === 'accepted' ? ann.annotator_label : selectedLabel;
  let reviewerSpans = null;
  let finalSpans = null;
  
  if (proj.task_type === 'ner') {
      const formattedSpans = Pages._nerEntities.map(e => ({ start: e.start, end: e.end, label: e.label, text: e.text }));
      reviewerSpans = JSON.stringify(formattedSpans);
      finalSpans = reviewerSpans;
      finalLabel = formattedSpans.length + ' entit' + (formattedSpans.length === 1 ? 'y' : 'ies') + ' tagged';
  }
  
  const existingReview = DB.reviews.byAnnotation(annotationId);
  const reviewData = { annotation_id: annotationId, item_id: ann.item_id, project_id: ann.project_id, reviewer_id: u.user_id, reviewer_label: finalLabel, reviewer_comment: comment, final_label: finalLabel, decision, review_timestamp: Utils.now(), reviewer_spans: reviewerSpans, final_spans: finalSpans };
  
  if (existingReview) {
    DB.reviews.update(existingReview.review_id, reviewData);
  } else {
    DB.reviews.create({ review_id: Utils.uuid(), ...reviewData });
  }
  const newAnnStatus = decision === 'rejected' ? 're_annotation_required' : 'review_complete';
  DB.annotations.update(annotationId, { status: newAnnStatus });
  if (decision === 'rejected') {
    // Reset the item assignment so the item re-appears in the annotator's queue
    const ia = DB.itemAssignments.byItem(ann.item_id).find(x => x.assigned_to === ann.annotator_id);
    if (ia) DB.itemAssignments.update(ia.ia_id, { status: 'pending' });
    const proj = DB.projects.get(ann.project_id);
    Notifs.push(ann.annotator_id, 'rejection', '🔄 Annotation Rejected',
      `Your annotation in "${proj?.project_name || 'a project'}" was rejected${comment ? ': "' + comment.slice(0, 80) + '"' : '.'} Please re-annotate.`, annotationId);
  } else {
    const proj = DB.projects.get(ann.project_id);
    Notifs.push(ann.annotator_id, 'approval',
      `Annotation ${decision === 'accepted' ? '✅ Accepted' : '✏️ Modified'}`,
      `Your annotation in "${proj?.project_name || 'a project'}" has been ${decision}.`, annotationId);
  }
  const msg = { accepted: '✅ Annotation accepted.', rejected: '❌ Annotation rejected — annotator notified.', modified: '✏️ Annotation modified and saved.' };
  Toast.success(msg[decision]);
  Router.navigate('review-queue');
};
