'use strict';
// ============================================================
// PHASE 3 — Analytics, Activity Log, User Guide
// ============================================================

// ── CHART HELPERS ─────────────────────────────────────────────
const ChartHelper = {
  velocitySVG: function (data) {
    var max = Math.max.apply(null, data.map(function (d) { return d.v; }));
    if (max < 1) max = 1;
    var bw = 42, gap = 10, H = 110, topPad = 22;
    var W = data.length * (bw + gap);
    var bars = data.map(function (d, i) {
      var barH = d.v > 0 ? Math.max(5, Math.round((d.v / max) * (H - topPad - 20))) : 0;
      var x = i * (bw + gap);
      var y = H - 20 - barH;
      var valueLabel = d.v > 0 ? '<text x="' + (x + bw / 2) + '" y="' + (y - 5) + '" text-anchor="middle" fill="var(--text-2)" font-size="11" font-family="Inter,sans-serif">' + d.v + '</text>' : '';
      return '<g><rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + barH + '" fill="var(--primary)" rx="4" opacity="0.85"/>' +
        '<text x="' + (x + bw / 2) + '" y="' + (H - 5) + '" text-anchor="middle" fill="var(--text-3)" font-size="10" font-family="Inter,sans-serif">' + d.l + '</text>' +
        valueLabel + '</g>';
    }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block;overflow:visible">' + bars + '</svg>';
  },
  hBars: function (data, maxVal) {
    if (!maxVal || maxVal < 1) maxVal = 1;
    return data.map(function (item) {
      var pct = Math.round((item.v / maxVal) * 100);
      var color = item.c || 'var(--primary)';
      return '<div style="margin-bottom:9px">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;color:var(--text-2)">' +
        '<span style="color:var(--text-1)">' + Utils.esc(item.l) + '</span><span>' + item.v + '</span></div>' +
        '<div class="progress-wrap"><div class="progress-bar" style="width:' + pct + '%;background:' + color + '"></div></div></div>';
    }).join('');
  },
};

// ── ANALYTICS PAGE ─────────────────────────────────────────────
Pages.analytics = function () {
  var projects = DB.projects.all();
  var allAnns = DB.annotations.all().filter(function (a) { return a.status !== 'draft'; });
  var allReviews = DB.reviews.all();
  var allItems = DB.items.all();
  var allUsers = DB.users.byRole('annotator');

  var accepted = allReviews.filter(function (r) { return r.decision === 'accepted'; }).length;
  var avgTime = allAnns.length
    ? Math.round(allAnns.reduce(function (s, a) { return s + (a.time_taken_seconds || 0); }, 0) / allAnns.length) : 0;
  var completionPct = Utils.pct(allAnns.length, allItems.length);

  // Velocity: last 7 days
  var last7 = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date(); d.setDate(d.getDate() - i);
    last7.push({ date: d.toISOString().slice(0, 10), l: d.toLocaleDateString('en', { weekday: 'short' }) });
  }
  var velocityData = last7.map(function (day) {
    return { l: day.l, v: allAnns.filter(function (a) { return (a.created_timestamp || '').startsWith(day.date); }).length };
  });
  var totalVelocity = velocityData.reduce(function (s, x) { return s + x.v; }, 0);

  // Review turnaround
  var turnaroundDays = allReviews.map(function (r) {
    var ann = DB.annotations.get(r.annotation_id);
    if (!ann || !ann.created_timestamp || !r.review_timestamp) return null;
    return (new Date(r.review_timestamp) - new Date(ann.created_timestamp)) / 86400000;
  }).filter(function (x) { return x !== null; });
  var avgTurnaround = turnaroundDays.length
    ? (turnaroundDays.reduce(function (s, x) { return s + x; }, 0) / turnaroundDays.length).toFixed(1) : '—';

  // Per-project cards
  var projectCards = projects.map(function (proj) {
    var items = DB.items.byProject(proj.project_id);
    var anns = DB.annotations.byProject(proj.project_id).filter(function (a) { return a.status !== 'draft'; });
    var revs = allReviews.filter(function (r) { return r.project_id === proj.project_id; });
    var pct = Utils.pct(anns.length, items.length);
    var labelSet = proj.label_set || Utils.defaultLabels(proj.task_type);
    var colors = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--danger)', 'var(--purple)', 'var(--cyan)'];
    var labelCounts = labelSet.map(function (l, idx) {
      return { l: l, v: anns.filter(function (a) { return a.annotator_label === l; }).length, c: colors[idx % 6] };
    });
    var maxLbl = Math.max.apply(null, labelCounts.map(function (x) { return x.v; }).concat([1]));
    var dl = proj.deadline ? new Date(proj.deadline) : null;
    var daysLeft = dl ? Math.ceil((dl - Date.now()) / 86400000) : null;
    var dlBadge = daysLeft === null ? '' :
      daysLeft < 0 ? '<span class="badge badge-danger">⏰ Overdue</span>' :
      daysLeft <= 3 ? '<span class="badge badge-danger">⏰ ' + daysLeft + 'd left</span>' :
      daysLeft <= 7 ? '<span class="badge badge-warning">⏰ ' + daysLeft + 'd left</span>' :
      '<span class="badge badge-muted">' + daysLeft + 'd left</span>';
    var reviewSummary = revs.length ? (
      '<div class="stat-mini"><span>✅ Accepted</span><strong>' + revs.filter(function (r) { return r.decision === 'accepted'; }).length + '</strong></div>' +
      '<div class="stat-mini"><span>✏️ Modified</span><strong>' + revs.filter(function (r) { return r.decision === 'modified'; }).length + '</strong></div>' +
      '<div class="stat-mini"><span>❌ Rejected</span><strong>' + revs.filter(function (r) { return r.decision === 'rejected'; }).length + '</strong></div>' +
      '<div class="stat-mini"><span>⏳ Pending</span><strong>' + anns.filter(function (a) { return a.status === 'submitted'; }).length + '</strong></div>'
    ) : '<p style="color:var(--text-2);font-size:12px">No reviews yet.</p>';

    return '<div class="card" style="margin-bottom:14px">' +
      '<div class="card-header"><div><span class="card-title">' + Utils.esc(proj.project_name) + '</span>' +
      '<span class="chip" style="margin-left:8px">' + Utils.taskLabel(proj.task_type) + '</span></div>' +
      '<div style="display:flex;gap:8px;align-items:center">' + dlBadge +
      '<span class="badge ' + Utils.badgeClass(proj.status) + '">' + Utils.statusLabel(proj.status) + '</span></div></div>' +
      '<div class="progress-label"><span>Progress: ' + anns.length + '/' + items.length + ' annotated</span><span>' + pct + '%</span></div>' +
      '<div class="progress-wrap" style="margin-bottom:16px"><div class="progress-bar" style="width:' + pct + '%"></div></div>' +
      '<div class="grid-2">' +
      '<div><div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:8px">LABEL DISTRIBUTION</div>' +
      (ChartHelper.hBars(labelCounts, maxLbl) || '<p style="color:var(--text-2);font-size:12px">No annotations yet.</p>') + '</div>' +
      '<div><div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:8px">REVIEW SUMMARY</div>' + reviewSummary + '</div>' +
      '</div></div>';
  }).join('');

  // Leaderboard
  var leaderboard = allUsers.map(function (u) {
    var uAnns = DB.annotations.byUser(u.user_id).filter(function (a) { return a.status !== 'draft'; });
    var uRevs = allReviews.filter(function (r) { return uAnns.some(function (a) { return a.annotation_id === r.annotation_id; }); });
    var acc = uRevs.filter(function (r) { return r.decision === 'accepted'; }).length;
    return { u: u, total: uAnns.length, accepted: acc, rate: Utils.pct(acc, uRevs.length) };
  }).sort(function (a, b) { return b.total - a.total; });

  var medals = ['🥇', '🥈', '🥉'];
  var medalColors = ['#f59e0b', '#9ca3af', '#b45309'];
  var lbRows = leaderboard.map(function (r, i) {
    var medal = medals[i] || (i + 1 + '.');
    var color = medalColors[i] || 'var(--text-3)';
    var badgeClass = r.rate >= 80 ? 'badge-success' : r.rate >= 60 ? 'badge-warning' : 'badge-muted';
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">' +
      '<div style="font-weight:700;font-size:16px;color:' + color + ';width:24px">' + medal + '</div>' +
      '<div class="avatar-sm">' + Utils.initials(r.u.full_name) + '</div>' +
      '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + Utils.esc(r.u.full_name) + '</div>' +
      '<div style="font-size:11px;color:var(--text-3)">' + r.total + ' submitted · ' + r.accepted + ' accepted</div></div>' +
      '<span class="badge ' + badgeClass + '">' + r.rate + '%</span></div>';
  }).join('');

  var refreshedAt = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });

  document.getElementById('main-content').innerHTML =
    '<div class="page-header"><div>' +
    '<div class="page-title">📊 Analytics Dashboard</div>' +
    '<div class="page-subtitle">Platform-wide annotation statistics and project health</div></div>' +
    '<span style="font-size:12px;color:var(--text-3)">Refreshed at ' + refreshedAt + ' · <span style="cursor:pointer;color:var(--primary)" onclick="Pages.analytics()">🔄 Refresh</span></span></div>' +

    '<div class="stat-grid" style="margin-bottom:24px">' +
    '<div class="stat-card"><div class="stat-icon">🗂️</div><div class="stat-value" style="color:var(--accent)">' + allItems.length + '</div><div class="stat-label">Total Items</div></div>' +
    '<div class="stat-card"><div class="stat-icon">✏️</div><div class="stat-value" style="color:var(--primary)">' + allAnns.length + '</div><div class="stat-label">Annotations</div></div>' +
    '<div class="stat-card"><div class="stat-icon">📈</div><div class="stat-value" style="color:var(--success)">' + completionPct + '%</div><div class="stat-label">Completion Rate</div></div>' +
    '<div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value" style="color:var(--success)">' + accepted + '</div><div class="stat-label">Accepted Reviews</div></div>' +
    '<div class="stat-card"><div class="stat-icon">⏱️</div><div class="stat-value" style="color:var(--warning)">' + avgTime + 's</div><div class="stat-label">Avg Time / Item</div></div>' +
    '<div class="stat-card"><div class="stat-icon">🔄</div><div class="stat-value" style="color:var(--purple)">' + avgTurnaround + (avgTurnaround !== '—' ? 'd' : '') + '</div><div class="stat-label">Avg Review TAT</div></div>' +
    '</div>' +

    '<div class="grid-2" style="margin-bottom:20px">' +
    '<div class="card"><div class="card-header"><span class="card-title">📅 Annotation Velocity (Last 7 Days)</span>' +
    '<span class="badge badge-muted">' + totalVelocity + ' this week</span></div>' +
    (totalVelocity > 0 ? ChartHelper.velocitySVG(velocityData) : '<div class="empty-state" style="padding:24px"><div class="empty-msg">No annotations in the last 7 days.</div></div>') +
    '</div>' +
    '<div class="card"><div class="card-header"><span class="card-title">🏅 Annotator Leaderboard</span></div>' +
    (lbRows || '<p style="color:var(--text-2)">No annotators found.</p>') +
    '</div></div>' +

    '<div class="card-title" style="margin-bottom:12px">📁 Project Breakdown</div>' +
    (projectCards || '<div class="empty-state"><div class="empty-icon">📁</div><div class="empty-msg">No projects yet.</div></div>');
};

// ── ACTIVITY LOG PAGE ──────────────────────────────────────────
Pages.activityLog = function () {
  var filterType    = (Router.params && Router.params.filterType)    || 'all';
  var filterUser    = (Router.params && Router.params.filterUser)    || 'all';
  var filterProject = (Router.params && Router.params.filterProject) || 'all';

  var events = [];

  DB.annotations.all().forEach(function (a) {
    if (!a.created_timestamp) return;
    var user = DB.users.get(a.annotator_id) || {};
    var item = DB.items.get(a.item_id) || {};
    var proj = DB.projects.get(a.project_id) || {};
    events.push({ ts: a.created_timestamp, type: 'annotation', icon: '✏️',
      user: user.full_name || '—', userId: a.annotator_id,
      action: 'Submitted annotation: "' + (a.annotator_label || '') + '"',
      project: proj.project_name || '—', projectId: a.project_id || '',
      detail: (item.text || item.prompt || '—').slice(0, 80) });
    if (a.last_edited_timestamp && a.last_edited_timestamp !== a.created_timestamp && a.edit_count > 0) {
      events.push({ ts: a.last_edited_timestamp, type: 'edit', icon: '🔄',
        user: user.full_name || '—', userId: a.annotator_id,
        action: 'Edited annotation (Edit #' + a.edit_count + ')',
        project: proj.project_name || '—', projectId: a.project_id || '',
        detail: (item.text || item.prompt || '—').slice(0, 80) });
    }
  });

  DB.reviews.all().forEach(function (r) {
    if (!r.review_timestamp) return;
    var reviewer = DB.users.get(r.reviewer_id) || {};
    var proj = DB.projects.get(r.project_id) || {};
    var iconMap = { accepted: '✅', rejected: '❌', modified: '✏️' };
    events.push({ ts: r.review_timestamp, type: 'review', icon: iconMap[r.decision] || '🔍',
      user: reviewer.full_name || '—', userId: r.reviewer_id,
      action: 'Review: ' + r.decision + ' → "' + (r.final_label || '') + '"',
      project: proj.project_name || '—', projectId: r.project_id || '',
      detail: (r.reviewer_comment || '').slice(0, 80) });
  });

  DB.history.all().forEach(function (h) {
    if (!h.timestamp) return;
    var user = DB.users.get(h.changed_by) || {};
    events.push({ ts: h.timestamp, type: 'edit', icon: '📝',
      user: user.full_name || '—', userId: h.changed_by,
      action: 'Changed label: "' + (h.old_label || '') + '" → "' + (h.new_label || '') + '"',
      project: '—', projectId: '',
      detail: h.change_type === 're_annotate' ? 'Re-annotation after rejection' : 'Manual edit' });
  });

  events.sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });

  var allUsers    = DB.users.all();
  var allProjects = DB.projects.all();
  var typeLabels  = { all: 'All Events', annotation: 'Annotations', review: 'Reviews', edit: 'Edits' };

  var filtered = events;
  if (filterType    !== 'all') filtered = filtered.filter(function (e) { return e.type      === filterType;    });
  if (filterUser    !== 'all') filtered = filtered.filter(function (e) { return e.userId    === filterUser;    });
  if (filterProject !== 'all') filtered = filtered.filter(function (e) { return e.projectId === filterProject; });
  var shown = filtered.slice(0, 150);

  var typeOptions = ['all', 'annotation', 'review', 'edit'].map(function (t) {
    return '<option value="' + t + '" ' + (filterType === t ? 'selected' : '') + '>' + typeLabels[t] + '</option>';
  }).join('');
  var userOptions = '<option value="all" ' + (filterUser === 'all' ? 'selected' : '') + '>All Users</option>' +
    allUsers.map(function (u) {
      return '<option value="' + u.user_id + '" ' + (filterUser === u.user_id ? 'selected' : '') + '>' + Utils.esc(u.full_name) + '</option>';
    }).join('');
  var projOptions = '<option value="all" ' + (filterProject === 'all' ? 'selected' : '') + '>All Projects</option>' +
    allProjects.map(function (p) {
      return '<option value="' + p.project_id + '" ' + (filterProject === p.project_id ? 'selected' : '') + '>' + Utils.esc(p.project_name) + '</option>';
    }).join('');

  var hasFilters  = filterType !== 'all' || filterUser !== 'all' || filterProject !== 'all';
  var countLabel  = events.length + ' total events · showing ' + shown.length +
    (filtered.length > 150 ? ' of ' + filtered.length + ' filtered' : '');

  var rows = shown.map(function (e) {
    return '<tr>' +
      '<td style="white-space:nowrap;font-size:12px;color:var(--text-3)">' + Utils.formatDate(e.ts) + '</td>' +
      '<td><span style="font-size:16px">' + e.icon + '</span></td>' +
      '<td style="font-size:12px">' + Utils.esc(e.user) + '</td>' +
      '<td style="font-size:13px"><strong>' + Utils.esc(e.action) + '</strong></td>' +
      '<td style="font-size:12px;color:var(--text-2)">' + Utils.esc(e.project) + '</td>' +
      '<td style="font-size:11px;color:var(--text-3);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + Utils.esc(e.detail) + '</td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-msg">No activity events match the current filters.</div></div></td></tr>';

  document.getElementById('main-content').innerHTML =
    '<div class="page-header"><div>' +
    '<div class="page-title">📋 Activity Log</div>' +
    '<div class="page-subtitle">' + countLabel + '</div></div>' +
    '<button class="btn btn-secondary" onclick="Pages._exportActivityLog()">⬇️ Export CSV</button></div>' +

    '<div class="card" style="margin-bottom:16px"><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">' +
    '<div class="form-group" style="margin:0"><label style="font-size:11px">Event Type</label>' +
    '<select class="form-select" style="width:160px" onchange="Pages._alSetFilter(\'filterType\',this.value)">' + typeOptions + '</select></div>' +
    '<div class="form-group" style="margin:0"><label style="font-size:11px">User</label>' +
    '<select class="form-select" style="width:180px" onchange="Pages._alSetFilter(\'filterUser\',this.value)">' + userOptions + '</select></div>' +
    '<div class="form-group" style="margin:0"><label style="font-size:11px">Project</label>' +
    '<select class="form-select" style="width:220px" onchange="Pages._alSetFilter(\'filterProject\',this.value)">' + projOptions + '</select></div>' +
    (hasFilters ? '<button class="btn btn-ghost btn-sm" onclick="Pages._alClearFilters()" style="align-self:flex-end;margin-bottom:1px">✕ Clear Filters</button>' : '') +
    '</div></div>' +

    '<div class="card"><div class="table-wrap"><table>' +
    '<thead><tr><th>Timestamp</th><th>Type</th><th>User</th><th>Action</th><th>Project</th><th>Detail</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div></div>';

  Pages._activityEvents = events;
};

Pages._alSetFilter = function (key, val) {
  if (!Router.params) Router.params = {};
  Router.params[key] = val;
  Pages.activityLog();
};

Pages._alClearFilters = function () {
  if (!Router.params) Router.params = {};
  Router.params.filterType    = 'all';
  Router.params.filterUser    = 'all';
  Router.params.filterProject = 'all';
  Pages.activityLog();
};

Pages._exportActivityLog = function () {
  var rows = (Pages._activityEvents || []).map(function (e) {
    return { timestamp: e.ts, type: e.type, user: e.user, action: e.action, project: e.project, detail: e.detail };
  });
  if (!rows.length) { Toast.warning('No events to export.'); return; }
  Utils.downloadCSV(rows, 'annotateai_activity_log_' + new Date().toISOString().slice(0, 10) + '.csv');
  Toast.success(rows.length + ' events exported.');
};

// ── USER GUIDE / HELP PAGE ─────────────────────────────────────
Pages.help = function (viewRole) {
  var userRole = Auth.currentUser ? Auth.currentUser.role : 'annotator';
  var activeRole = viewRole || userRole;
  var userName = Auth.currentUser ? Auth.currentUser.full_name : '';

  var guideSections = {
    annotator: [
      { title: '1. Your Annotation Queue', icon: '✏️', body: 'Your queue shows all items assigned to you. Items marked <strong>🔄 Redo Required</strong> were rejected — re-read the instructions carefully before re-annotating.' },
      { title: '2. How to Annotate', icon: '📝', body: 'Open any pending item. Read the content carefully, click the best matching label, optionally add a comment and confidence level, then click <strong>Submit ✓</strong>.' },
      { title: '3. Editing Before Review', icon: '🔄', body: 'After submitting, go to <strong>My Submissions</strong> and click <strong>✏️ Edit</strong> to make changes — but only before a reviewer has processed it. Once reviewed, it is locked.' },
      { title: '4. Confidence Levels', icon: '💡', body: '<strong>High</strong> — completely sure. <strong>Medium</strong> — fairly confident. <strong>Low</strong> — unsure; flags the item for careful review by the reviewer.' },
      { title: '5. Gold Standard Items', icon: '🏆', body: 'Some items have hidden correct answers to score your accuracy silently. Treat every item the same — you cannot tell which ones are gold standard.' },
    ],
    reviewer: [
      { title: '1. Review Queue', icon: '🔍', body: 'Shows all submitted annotations awaiting your review. You cannot review your own submissions. In Blind Review mode, annotator names are hidden until you hover.' },
      { title: '2. Review Decisions', icon: '⚖️', body: '<strong>✅ Accept</strong> — label is correct as-is. <strong>✏️ Modify</strong> — override with the correct label. <strong>❌ Reject</strong> — send back with a reason so the annotator can redo it.' },
      { title: '3. Good Feedback', icon: '💬', body: 'Be specific in rejection comments: explain why the label is wrong and what the correct one should be. Clear feedback helps annotators improve their accuracy over time.' },
    ],
    admin: [
      { title: '1. Projects Dashboard & Icons', icon: '💻', body: 'The Projects screen displays your active datasets. Use the action icons on the right: <strong>✏️ Edit</strong> (change settings/instructions), <strong>📤 Upload</strong> (import CSV data), and <strong>👥 Assign</strong> (allocate items to annotators/reviewers). Hover over any icon for a tooltip.' },
      { title: '2. Creating Projects', icon: '📁', body: 'Go to <strong>Projects → + New Project</strong>. Set the task type, write clear annotation instructions, and define labels. Set status to <em>Active</em> when ready for annotators.' },
      { title: '3. Uploading Data', icon: '📤', body: 'Click <strong>📤 Upload</strong> next to a project. Upload a CSV with columns: <code>text</code>, <code>prompt</code>, <code>ai_response</code>, <code>response_a</code>, <code>response_b</code>.' },
      { title: '3. Assigning Work', icon: '👥', body: 'Click <strong>👥 Assign</strong>. Choose an annotator and a distribution mode: All Items, First N, or Round-Robin across all assigned annotators.' },
      { title: '4. IAA (Inter-Annotator Agreement)', icon: '🤝', body: 'Cohen\'s Kappa benchmarks: <strong>&lt;0.4</strong> = Poor, <strong>0.4–0.6</strong> = Moderate, <strong>0.6–0.8</strong> = Good, <strong>&gt;0.8</strong> = Excellent. Assign 3+ annotators to the same items to measure IAA.' },
      { title: '5. Gold Standard', icon: '🏆', body: 'In <strong>Quality Control → Gold Standard</strong>, mark items with known correct answers. The system silently scores annotator accuracy against these items.' },
      { title: '6. Exporting Data', icon: '📊', body: 'Go to <strong>Export Center</strong>. Download as <strong>CSV</strong> (compatible with Microsoft Access and Excel), <strong>JSON</strong>, or <strong>JSONL</strong> (for HuggingFace / LLM fine-tuning pipelines).' },
      { title: '7. Backup & Restore', icon: '💾', body: 'In <strong>Settings → Data Management</strong>, click <strong>Backup All Data</strong> to download a full JSON snapshot of the platform at any time.' },
    ],
  };

  var generalSections = [
    { title: 'Notifications', icon: '🔔', body: 'The 🔔 bell icon shows system notifications: new assignments, review results, rejection feedback, and deadline reminders. Reminders fire automatically when a project deadline is within 7 days.' },
    { title: 'Session Timeout', icon: '⏰', body: 'The system logs you out after inactivity (configured by Admin in Settings). A yellow warning banner appears 2 minutes before your session expires — move your mouse or press any key to stay logged in.' },
    { title: 'Data Export', icon: '📥', body: 'Annotation data can be exported as CSV (for Microsoft Access/Excel), JSON, or JSONL. The JSONL format includes prompt, response, and label fields ready for LLM fine-tuning pipelines.' },
  ];

  function renderSection(s) {
    return '<div style="padding:16px;border-radius:var(--r-lg);background:var(--bg-elevated);margin-bottom:10px">' +
      '<div style="font-size:15px;font-weight:700;margin-bottom:8px">' + s.icon + ' ' + s.title + '</div>' +
      '<div style="font-size:13px;color:var(--text-2);line-height:1.7">' + s.body + '</div></div>';
  }

  var myGuide = guideSections[activeRole] || guideSections.annotator;

  // Admin gets tabs to browse guides for all roles
  var roleTabs = '';
  if (userRole === 'admin') {
    var tabDefs = [
      { key: 'admin',     label: '🔧 Admin' },
      { key: 'annotator', label: '✏️ Annotator' },
      { key: 'reviewer',  label: '🔍 Reviewer' },
    ];
    roleTabs = '<div class="tabs" style="margin-bottom:20px">' +
      tabDefs.map(function (t) {
        return '<div class="tab ' + (activeRole === t.key ? 'active' : '') + '" onclick="Pages.help(\'' + t.key + '\')">' + t.label + '</div>';
      }).join('') +
      '</div>';
  }

  var guideSubtitle = userRole === 'admin' && activeRole !== userRole
    ? 'Viewing ' + activeRole + ' guide (you are Admin)'
    : 'How to use AnnotateAI as a ' + activeRole;

  document.getElementById('main-content').innerHTML =
    '<div class="page-header"><div>' +
    '<div class="page-title">❓ User Guide</div>' +
    '<div class="page-subtitle">' + guideSubtitle + '</div></div></div>' +

    '<div style="max-width:760px">' +
    '<div style="background:linear-gradient(135deg,var(--primary),var(--accent));border-radius:var(--r-xl);padding:20px 24px;margin-bottom:20px;color:white">' +
    '<div style="font-size:18px;font-weight:700;margin-bottom:4px">Welcome to AnnotateAI 🧠</div>' +
    '<div style="font-size:13px;opacity:0.9">Logged in as <strong>' + Utils.esc(userName) + '</strong> · Role: <strong>' + userRole + '</strong></div></div>' +

    roleTabs +

    '<div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:1px;margin-bottom:10px">' + activeRole.toUpperCase() + ' GUIDE</div>' +
    myGuide.map(renderSection).join('') +

    '<div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:1px;margin:20px 0 10px">GENERAL</div>' +
    generalSections.map(renderSection).join('') +

    '<div style="padding:14px;border-radius:var(--r-lg);border:1px solid var(--border);margin-top:12px;font-size:12px;color:var(--text-2)">' +
    '📞 Need more help? Contact your system administrator.</div></div>';
};

// Phase 3 helper CSS
try {
  var s3 = document.createElement('style');
  s3.textContent = '.stat-mini{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text-2)}.stat-mini strong{color:var(--text-1);font-size:14px}';
  (document.head || document.documentElement).appendChild(s3);
} catch (e) { /* no-op */ }
