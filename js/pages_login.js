'use strict';
// ============================================================
// PAGES — Login & Dashboard (shared across roles)
// ============================================================
const Pages = {};

// ── LOGIN ────────────────────────────────────────────────────
Pages.login = function () {
  document.getElementById('view-login').innerHTML = `
    <div class="login-card">
      <div class="login-brand">
        <div class="login-brand-icon">🧠</div>
        <div><div class="login-title">AnnotateAI</div></div>
      </div>
      <p class="login-subtitle">AI Training Data Annotation Platform</p>
      <div class="form-group"><label>Username</label>
        <input class="form-input" id="li-u" placeholder="Enter username" autocomplete="username" /></div>
      <div class="form-group"><label>Password</label>
        <input class="form-input" type="password" id="li-p" placeholder="Enter password" autocomplete="current-password" /></div>
      <div id="li-err" style="color:var(--danger);font-size:13px;margin-bottom:10px;display:none"></div>
      <button class="btn btn-primary w-full btn-lg" id="li-btn">Sign In →</button>
      <div class="demo-accounts">
        <div class="demo-label">Demo Accounts — click to fill</div>
        <div class="demo-item" onclick="Pages._fill('admin','admin123')"><span class="demo-tag">Admin</span> admin / admin123</div>
        <div class="demo-item" onclick="Pages._fill('annotator1','ann123')"><span class="demo-tag">Annotator</span> annotator1 / ann123</div>
        <div class="demo-item" onclick="Pages._fill('reviewer1','rev123')"><span class="demo-tag">Reviewer</span> reviewer1 / rev123</div>
      </div>
    </div>`;
  const doLogin = () => {
    const u = document.getElementById('li-u').value;
    const p = document.getElementById('li-p').value;
    const err = document.getElementById('li-err');
    const res = Auth.login(u, p);
    if (!res.ok) { err.textContent = res.msg; err.style.display = 'block'; return; }
    err.style.display = 'none';
    Layout.show();
    Router.navigate('dashboard');
  };
  document.getElementById('li-btn').onclick = doLogin;
  document.getElementById('li-p').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
};
Pages._fill = (u, p) => { document.getElementById('li-u').value = u; document.getElementById('li-p').value = p; };

// ── DASHBOARD ─────────────────────────────────────────────────
Pages.dashboard = function () {
  const u = Auth.currentUser;
  const role = u.role;
  const allAnnotations = DB.annotations.all();
  const allReviews = DB.reviews.all();
  const allProjects = DB.projects.all();
  const allItems = DB.items.all();

  let stats = [], extra = '';

  if (role === 'admin') {
    const annotated = allAnnotations.filter(a => a.status !== 'draft').length;
    const reviewed = allReviews.length;
    const pending = allAnnotations.filter(a => a.status === 'submitted').length;
    const agreed = allReviews.filter(r => r.decision === 'accepted').length;
    stats = [
      { icon:'📁', v: allProjects.filter(p=>p.status==='active').length, label:'Active Projects', c:'var(--primary)' },
      { icon:'🗂️', v: allItems.length, label:'Total Items', c:'var(--accent)' },
      { icon:'✏️', v: annotated, label:'Annotated', c:'var(--success)' },
      { icon:'🔍', v: reviewed, label:'Reviewed', c:'var(--purple)' },
      { icon:'⏳', v: pending, label:'Pending Review', c:'var(--warning)' },
      { icon:'🤝', v: Utils.pct(agreed, allReviews.length)+'%', label:'Agreement Rate', c:'var(--success)' },
    ];
    const rows = allProjects.map(p => {
      const items = DB.items.byProject(p.project_id).length;
      const done = DB.annotations.byProject(p.project_id).filter(a=>a.status!=='draft').length;
      const pct = Utils.pct(done, items);
      return `<tr>
        <td><strong>${Utils.esc(p.project_name)}</strong></td>
        <td><span class="badge ${Utils.badgeClass(p.status)}">${Utils.statusLabel(p.status)}</span></td>
        <td>${items}</td>
        <td><div class="progress-label"><span>${done}/${items}</span><span>${pct}%</span></div>
          <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div></td>
        <td>${Utils.formatDate(p.created_date)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" title="Upload Data (CSV or Manual Text)" onclick="Router.navigate('upload-data',{id:'${p.project_id}'})">📤 Upload</button>
          <button class="btn btn-ghost btn-sm" title="Assign Items to Annotators and Reviewers" onclick="Router.navigate('assign-work',{id:'${p.project_id}'})">👥 Assign</button>
        </td></tr>`;
    }).join('') || `<tr><td colspan="6"><div class="empty-state">
      <div class="empty-icon">📁</div><div class="empty-msg">No projects yet.</div>
      <button class="btn btn-primary" onclick="Router.navigate('create-project')">+ Create Project</button></div></td></tr>`;
    extra = `<div class="card mt-3">
      <div class="card-header"><span class="card-title">📁 Projects Overview</span>
        <button class="btn btn-primary btn-sm" onclick="Router.navigate('create-project')">+ New Project</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Project</th><th>Status</th><th>Items</th><th>Progress</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>`;

  } else if (role === 'annotator') {
    const myIAs = DB.itemAssignments.byUser(u.user_id);
    const myAnns = DB.annotations.byUser(u.user_id);
    const done = myAnns.filter(a => a.status !== 'draft').length;
    const rejected = myAnns.filter(a => a.status === 'rejected').length;
    const myRevs = allReviews.filter(r => myAnns.some(a => a.annotation_id === r.annotation_id));
    const agreed = myRevs.filter(r => r.decision === 'accepted').length;
    stats = [
      { icon:'📋', v: myIAs.length, label:'Assigned Items', c:'var(--primary)' },
      { icon:'✅', v: done, label:'Submitted', c:'var(--success)' },
      { icon:'⏳', v: myIAs.length - done, label:'Pending', c:'var(--warning)' },
      { icon:'❌', v: rejected, label:'Rejected', c:'var(--danger)' },
      { icon:'🤝', v: Utils.pct(agreed, myRevs.length)+'%', label:'Agreement Rate', c:'var(--success)' },
    ];
    const pending = myIAs.filter(ia => {
      const ann = DB.annotations.byItemAndUser(ia.item_id, u.user_id);
      return !ann || ann.status === 'draft' || ann.status === 're_annotation_required';
    }).slice(0, 5);
    extra = pending.length ? `<div class="card mt-3">
      <div class="card-header"><span class="card-title">⏳ Pending Items</span>
        <button class="btn btn-primary btn-sm" onclick="Router.navigate('queue')">Full Queue →</button></div>
      ${pending.map(ia => {
        const item = DB.items.get(ia.item_id);
        const proj = item ? DB.projects.get(item.project_id) : null;
        return item ? `<div class="queue-item" onclick="Router.navigate('annotate',{itemId:'${ia.item_id}',iaId:'${ia.ia_id}'})">
          <span style="font-size:18px">✏️</span>
          <div class="queue-item-text">${Utils.esc((item.text || item.prompt || '').slice(0, 120))}</div>
          <span class="badge badge-muted">${proj?.project_name || '—'}</span></div>` : '';
      }).join('')}</div>` : `<div class="card mt-3 empty-state"><div class="empty-icon">✅</div><div class="empty-title">All caught up!</div><div class="empty-msg">No pending items in your queue.</div></div>`;

  } else if (role === 'reviewer') {
    const submitted = allAnnotations.filter(a => a.status === 'submitted').length;
    const myRevs = DB.reviews.byReviewer(u.user_id);
    const accepted = myRevs.filter(r => r.decision === 'accepted').length;
    stats = [
      { icon:'📋', v: submitted, label:'Awaiting Review', c:'var(--warning)' },
      { icon:'✅', v: myRevs.filter(r=>r.decision==='accepted').length, label:'Accepted', c:'var(--success)' },
      { icon:'✏️', v: myRevs.filter(r=>r.decision==='modified').length, label:'Modified', c:'var(--primary)' },
      { icon:'❌', v: myRevs.filter(r=>r.decision==='rejected').length, label:'Rejected', c:'var(--danger)' },
      { icon:'🤝', v: Utils.pct(accepted, myRevs.length)+'%', label:'Acceptance Rate', c:'var(--success)' },
    ];
    extra = `<div class="card mt-3">
      <div class="card-header"><span class="card-title">🔍 Review Queue</span>
        <button class="btn btn-primary btn-sm" onclick="Router.navigate('review-queue')">Open Queue →</button></div>
      <p style="color:var(--text-2);font-size:14px">${submitted} annotation${submitted !== 1 ? 's' : ''} awaiting your review.</p></div>`;
  }

  const statsHtml = `<div class="stat-grid">${stats.map(s => `
    <div class="stat-card">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-value" style="color:${s.c}">${s.v}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('')}</div>`;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Welcome back, ${Utils.esc(u.full_name.split(' ')[0])} 👋</div>
        <div class="page-subtitle">${role.charAt(0).toUpperCase()+role.slice(1)} · ${Utils.formatDate(Utils.now())}</div></div>
    </div>${statsHtml}${extra}`;
};
