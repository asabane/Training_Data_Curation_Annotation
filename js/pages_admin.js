'use strict';
// ============================================================
// PAGES — Admin: Users, Projects, Upload, Assign, Export, Settings
// ============================================================

// ── USERS ────────────────────────────────────────────────────
Pages.users = function () {
  const users = DB.users.all();
  const rows = users.map(u => `<tr>
    <td><div style="display:flex;align-items:center;gap:10px">
      <div class="avatar-sm">${Utils.initials(u.full_name)}</div>
      <div><div style="font-weight:600">${Utils.esc(u.full_name)}</div>
        <div style="font-size:11px;color:var(--text-3)">${Utils.esc(u.username)}</div></div></div></td>
    <td><span class="badge badge-primary" style="text-transform:capitalize">${u.role}</span></td>
    <td>${Utils.esc(u.email || '—')}</td>
    <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
    <td>${Utils.formatDate(u.last_login) || 'Never'}</td>
    <td style="white-space:nowrap">
      <button class="btn btn-ghost btn-sm" onclick="Router.navigate('edit-user',{id:'${u.user_id}'})">✏️ Edit</button>
      <button class="btn btn-ghost btn-sm" onclick="Pages._toggleUser('${u.user_id}',${u.is_active})">${u.is_active ? 'Deactivate' : 'Activate'}</button>
      ${u.user_id !== Auth.currentUser.user_id ? `<button class="btn btn-danger btn-sm" onclick="Pages._deleteUser('${u.user_id}')">🗑️</button>` : ''}
    </td></tr>`).join('') || `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-msg">No users yet.</div></div></td></tr>`;
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">👥 User Management</div><div class="page-subtitle">${users.length} users registered</div></div>
      <button class="btn btn-primary" onclick="Router.navigate('create-user')">+ New User</button>
    </div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>User</th><th>Role</th><th>Email</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
};
Pages._toggleUser = (id, isActive) => {
  if (id === Auth.currentUser.user_id) { Toast.error("You can't deactivate yourself."); return; }
  DB.users.update(id, { is_active: !isActive });
  Toast.success(`User ${isActive ? 'deactivated' : 'activated'}.`);
  Pages.users();
};
Pages._deleteUser = id => {
  Modal.confirm('Delete User', 'Permanently delete this user account?', () => { DB.users.delete(id); Toast.success('User deleted.'); Pages.users(); }, true);
};

Pages._userForm = function (title, def, onSubmit) {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header"><div><div class="page-title">${title}</div></div>
      <button class="btn btn-ghost" onclick="Router.navigate('users')">← Back</button></div>
    <div class="card" style="max-width:600px">
      <div class="form-row">
        <div class="form-group"><label>Full Name *</label><input class="form-input" id="uf-name" value="${Utils.esc(def.full_name||'')}" placeholder="Jane Smith" /></div>
        <div class="form-group"><label>Username *</label><input class="form-input" id="uf-uname" value="${Utils.esc(def.username||'')}" placeholder="jsmith" ${def.user_id ? 'readonly style="opacity:0.6"' : ''} /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Password ${def.user_id ? '(blank = keep)' : '*'}</label><input class="form-input" type="password" id="uf-pass" placeholder="Password" /></div>
        <div class="form-group"><label>Role *</label><select class="form-select" id="uf-role">
          <option value="annotator" ${def.role==='annotator'?'selected':''}>Annotator</option>
          <option value="reviewer" ${def.role==='reviewer'?'selected':''}>Reviewer</option>
          <option value="admin" ${def.role==='admin'?'selected':''}>Admin</option>
        </select></div>
      </div>
      <div class="form-group"><label>Email</label><input class="form-input" id="uf-email" value="${Utils.esc(def.email||'')}" placeholder="email@example.com" /></div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="Router.navigate('users')">Cancel</button>
        <button class="btn btn-primary" id="uf-save">${def.user_id ? 'Save Changes' : 'Create User'}</button>
      </div></div>`;
  document.getElementById('uf-save').onclick = onSubmit;
};

Pages.createUser = function () {
  Pages._userForm('Create New User', {}, () => {
    const name = document.getElementById('uf-name').value.trim();
    const uname = document.getElementById('uf-uname').value.trim();
    const pass = document.getElementById('uf-pass').value;
    const role = document.getElementById('uf-role').value;
    const email = document.getElementById('uf-email').value.trim();
    if (!name || !uname || !pass) { Toast.error('Name, username and password are required.'); return; }
    if (DB.users.byUsername(uname)) { Toast.error('Username already exists.'); return; }
    DB.users.create({ user_id: Utils.uuid(), full_name: name, username: uname, password: pass, role, email, is_active: true, created_by: Auth.currentUser.user_id, created_date: Utils.now(), last_login: null });
    Toast.success('User created!'); Router.navigate('users');
  });
};

Pages.editUser = function (id) {
  const user = DB.users.get(id);
  if (!user) { Toast.error('User not found.'); Router.navigate('users'); return; }
  Pages._userForm('Edit User', user, () => {
    const name = document.getElementById('uf-name').value.trim();
    const pass = document.getElementById('uf-pass').value;
    const role = document.getElementById('uf-role').value;
    const email = document.getElementById('uf-email').value.trim();
    if (!name) { Toast.error('Name is required.'); return; }
    const ch = { full_name: name, role, email };
    if (pass) ch.password = pass;
    DB.users.update(id, ch); Toast.success('User updated.'); Router.navigate('users');
  });
};

// ── PROJECTS ─────────────────────────────────────────────────
Pages.projects = function () {
  const projects = DB.projects.all();
  const body = projects.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📁</div><div class="empty-title">No projects</div><div class="empty-msg">Create your first annotation project to get started.</div><button class="btn btn-primary" onclick="Router.navigate('create-project')">+ Create Project</button></div>`
    : `<div class="table-wrap"><table><thead><tr><th>Project</th><th>Task Type</th><th>Status</th><th>Items</th><th>Labels</th><th>Deadline</th><th>Actions</th></tr></thead><tbody>
      ${projects.map(p => `<tr>
        <td><strong>${Utils.esc(p.project_name)}</strong></td>
        <td><span class="chip">${Utils.taskLabel(p.task_type)}</span></td>
        <td><span class="badge ${Utils.badgeClass(p.status)}">${Utils.statusLabel(p.status)}</span></td>
        <td>${DB.items.byProject(p.project_id).length}</td>
        <td>${(p.label_set||[]).slice(0,3).map(l=>`<span class="label-tag" style="font-size:10px">${Utils.esc(l)}</span>`).join(' ')}${p.label_set?.length>3?` +${p.label_set.length-3}`:''}</td>
        <td>${Utils.formatDate(p.deadline)||'—'}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm" title="Edit Project Settings and Instructions" onclick="Router.navigate('edit-project',{id:'${p.project_id}'})">✏️</button>
          <button class="btn btn-ghost btn-sm" title="Upload Data (CSV or Manual Text)" onclick="Router.navigate('upload-data',{id:'${p.project_id}'})">📤</button>
          <button class="btn btn-ghost btn-sm" title="Assign Items to Annotators and Reviewers" onclick="Router.navigate('assign-work',{id:'${p.project_id}'})">👥</button>
          <button class="btn btn-danger btn-sm" onclick="Pages._delProj('${p.project_id}')">🗑️</button>
        </td></tr>`).join('')}</tbody></table></div>`;
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📁 Projects</div><div class="page-subtitle">${projects.length} projects</div></div>
      <button class="btn btn-primary" onclick="Router.navigate('create-project')">+ New Project</button>
    </div><div class="card">${body}</div>`;
};
Pages._delProj = id => Modal.confirm('Delete Project', 'Delete all items and annotations for this project? Cannot be undone.', () => {
  DB.items.byProject(id).forEach(i => { DB.annotations.byItem(i.item_id).forEach(a => DB.annotations.delete(a.annotation_id)); DB.items.delete(i.item_id); });
  DB.projects.delete(id); Toast.success('Project deleted.'); Pages.projects();
}, true);

Pages._projectForm = function (title, def, onSubmit) {
  const labels = def.label_set || [];
  document.getElementById('main-content').innerHTML = `
    <div class="page-header"><div><div class="page-title">${title}</div></div>
      <button class="btn btn-ghost" onclick="Router.navigate('projects')">← Back</button></div>
    <div class="card" style="max-width:720px">
      <div class="form-row">
        <div class="form-group"><label>Project Name *</label><input class="form-input" id="pf-name" value="${Utils.esc(def.project_name||'')}" placeholder="e.g. Customer Feedback Q2" /></div>
        <div class="form-group"><label>Task Type *</label><select class="form-select" id="pf-type" onchange="Pages._onTaskTypeChange()">
          <option value="text_classification" ${def.task_type==='text_classification'?'selected':''}>Text Classification</option>
          <option value="sentiment" ${def.task_type==='sentiment'?'selected':''}>Sentiment Analysis</option>
          <option value="intent" ${def.task_type==='intent'?'selected':''}>Intent Classification</option>
          <option value="ner" ${def.task_type==='ner'?'selected':''}>Span Annotation (NER / Context Tagging)</option>
          <option value="ai_evaluation" ${def.task_type==='ai_evaluation'?'selected':''}>AI Response Evaluation</option>
          <option value="response_comparison" ${def.task_type==='response_comparison'?'selected':''}>Response Comparison (A vs B)</option>
        </select></div>
      </div>
      <div class="form-group"><label>Annotation Instructions *</label>
        <textarea class="form-textarea" id="pf-instr" rows="4" placeholder="Guidelines shown to annotators...">${Utils.esc(def.instructions||'')}</textarea></div>
      <div class="form-group"><label>Label Set</label>
        <div class="label-tags" id="pf-tags">${labels.map(l=>`<span class="label-tag">${Utils.esc(l)}<span class="label-tag-x" onclick="this.parentElement.remove()">×</span></span>`).join('')}</div>
        <div style="display:flex;gap:8px">
          <input class="form-input" id="pf-linp" placeholder="Type a label and press Enter" style="flex:1" />
          <button class="btn btn-secondary" onclick="Pages._addLabel()">+ Add</button>
        </div>
        <div style="font-size:12px;color:var(--text-3);margin-top:6px">If empty, default labels for the task type will be used.</div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Status</label><select class="form-select" id="pf-status">
          <option value="draft" ${!def.status||def.status==='draft'?'selected':''}>Draft</option>
          <option value="active" ${def.status==='active'?'selected':''}>Active</option>
          <option value="completed" ${def.status==='completed'?'selected':''}>Completed</option>
          <option value="archived" ${def.status==='archived'?'selected':''}>Archived</option>
        </select></div>
        <div class="form-group"><label>Deadline (optional)</label><input class="form-input" type="date" id="pf-dl" value="${def.deadline||''}" /></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="Router.navigate('projects')">Cancel</button>
        <button class="btn btn-primary" id="pf-save">${def.project_id ? 'Save Changes' : 'Create Project'}</button>
      </div></div>`;
  document.getElementById('pf-linp').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); Pages._addLabel(); } };
  document.getElementById('pf-save').onclick = onSubmit;
};
Pages._addLabel = () => {
  const inp = document.getElementById('pf-linp');
  const val = inp.value.trim(); if (!val) return;
  const tags = document.getElementById('pf-tags');
  const sp = document.createElement('span'); sp.className = 'label-tag';
  sp.innerHTML = `${Utils.esc(val)}<span class="label-tag-x" onclick="this.parentElement.remove()">×</span>`;
  tags.appendChild(sp); inp.value = ''; inp.focus();
};
Pages._onTaskTypeChange = () => {
  const type = document.getElementById('pf-type').value;
  const tags = document.getElementById('pf-tags');
  if (tags.children.length === 0) {
    const defs = Utils.defaultLabels(type);
    defs.forEach(l => {
      const sp = document.createElement('span'); sp.className = 'label-tag';
      sp.innerHTML = `${Utils.esc(l)}<span class="label-tag-x" onclick="this.parentElement.remove()">×</span>`;
      tags.appendChild(sp);
    });
  }
};
Pages._collectProject = () => ({
  name: document.getElementById('pf-name').value.trim(),
  type: document.getElementById('pf-type').value,
  instr: document.getElementById('pf-instr').value.trim(),
  status: document.getElementById('pf-status').value,
  deadline: document.getElementById('pf-dl').value,
  labels: [...document.querySelectorAll('#pf-tags .label-tag')].map(el => el.childNodes[0].textContent.trim()).filter(Boolean),
});
Pages.createProject = function () {
  Pages._projectForm('Create New Project', {}, () => {
    const { name, type, instr, status, deadline, labels } = Pages._collectProject();
    if (!name || !instr) { Toast.error('Name and instructions are required.'); return; }
    DB.projects.create({ project_id: Utils.uuid(), project_name: name, task_type: type, label_set: labels.length ? labels : Utils.defaultLabels(type), instructions: instr, status, deadline: deadline || null, created_by: Auth.currentUser.user_id, created_date: Utils.now(), instructions_version: 1 });
    Toast.success('Project created!'); Router.navigate('projects');
  });
};
Pages.editProject = function (id) {
  const proj = DB.projects.get(id);
  if (!proj) { Toast.error('Not found.'); Router.navigate('projects'); return; }
  Pages._projectForm('Edit Project', proj, () => {
    const { name, type, instr, status, deadline, labels } = Pages._collectProject();
    if (!name || !instr) { Toast.error('Name and instructions required.'); return; }
    DB.projects.update(id, { project_name: name, task_type: type, label_set: labels.length ? labels : Utils.defaultLabels(type), instructions: instr, status, deadline: deadline || null });
    Toast.success('Project updated.'); Router.navigate('projects');
  });
};

// ── UPLOAD DATA ───────────────────────────────────────────────
Pages.uploadData = function (projId) {
  const proj = DB.projects.get(projId);
  if (!proj) { Toast.error('Project not found.'); Router.navigate('projects'); return; }
  const existing = DB.items.byProject(projId).length;
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📤 Upload Data</div>
        <div class="page-subtitle">Project: <strong>${Utils.esc(proj.project_name)}</strong> · ${existing} items uploaded</div></div>
      <button class="btn btn-ghost" onclick="Router.navigate('projects')">← Back</button>
    </div>
    <div class="card" style="max-width:800px">
      <div class="file-drop-zone" id="fz">
        <div class="file-drop-icon">📂</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:6px">Drop your CSV file here</div>
        <div style="font-size:13px;color:var(--text-2);margin-bottom:16px">or click to browse</div>
        <button class="btn btn-secondary" onclick="document.getElementById('csv-in').click()">Choose File</button>
        <input type="file" id="csv-in" accept=".csv" style="display:none" />
      </div>
      <div style="margin-top:14px;padding:12px;background:var(--bg-elevated);border-radius:var(--r-md);font-size:12px;color:var(--text-2)">
        <strong style="color:var(--text-1)">Supported CSV columns:</strong>
        id, text, prompt, ai_response, response_a, response_b
      </div>
      <div id="csv-preview" style="margin-top:16px"></div>
    </div>`;

  const handleFile = file => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const { headers, rows } = Utils.parseCSV(e.target.result);
      const preview = document.getElementById('csv-preview');
      if (!rows.length) { preview.innerHTML = '<div style="color:var(--danger);font-size:13px">❌ No data rows found in CSV.</div>'; return; }
      preview.innerHTML = `
        <div class="card-header"><span class="card-title">Preview — ${rows.length} rows detected</span></div>
        <div class="table-wrap" style="max-height:240px;overflow-y:auto"><table>
          <thead><tr>${headers.map(h=>`<th>${Utils.esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${rows.slice(0,5).map(r=>`<tr>${headers.map(h=>`<td>${Utils.esc((r[h.toLowerCase().trim()]||'').slice(0,60))}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        ${rows.length > 5 ? `<div style="font-size:12px;color:var(--text-2);margin-top:8px">... and ${rows.length-5} more rows</div>` : ''}
        <div class="form-actions">
          <button class="btn btn-primary" id="do-import">✅ Import ${rows.length} Items</button>
        </div>`;
      document.getElementById('do-import').onclick = () => Pages._importCSV(projId, rows);
    };
    reader.readAsText(file);
  };

  document.getElementById('csv-in').onchange = e => handleFile(e.target.files[0]);
  const fz = document.getElementById('fz');
  fz.onclick = () => document.getElementById('csv-in').click();
  fz.ondragover = e => { e.preventDefault(); fz.classList.add('over'); };
  fz.ondragleave = () => fz.classList.remove('over');
  fz.ondrop = e => { e.preventDefault(); fz.classList.remove('over'); handleFile(e.dataTransfer.files[0]); };
};
Pages._importCSV = (projId, rows) => {
  const items = rows.map(r => ({
    item_id: Utils.uuid(), project_id: projId,
    original_id: r.id || r.item_id || Utils.uuid(),
    text: r.text || '', prompt: r.prompt || '',
    ai_response: r.ai_response || r.response || '',
    response_a: r.response_a || r.response_a || '',
    response_b: r.response_b || '',
    item_status: 'active', is_gold_standard: false, gold_standard_label: '',
    uploaded_by: Auth.currentUser.user_id, upload_date: Utils.now(),
  }));
  DB.items.bulkCreate(items);
  Toast.success(`${items.length} items imported successfully!`);
  Router.navigate('upload-data', { id: projId });
};

// ── ASSIGN WORK ───────────────────────────────────────────────
Pages.assignWork = function (projId) {
  const proj = DB.projects.get(projId);
  if (!proj) { Toast.error('Project not found.'); Router.navigate('projects'); return; }
  const items = DB.items.byProject(projId);
  const annotators = DB.users.byRole('annotator');
  const currentAssignments = DB.assignments.byProject(projId);
  const assignedAnnotators = currentAssignments.filter(a => a.role === 'annotator').map(a => DB.users.get(a.user_id)).filter(Boolean);
  const reviewers = DB.users.byRole('reviewer');
  const assignedReviewers = currentAssignments.filter(a => a.role === 'reviewer').map(a => DB.users.get(a.user_id)).filter(Boolean);
  const iaMap = {};
  DB.itemAssignments.byProject(projId).forEach(ia => { iaMap[ia.item_id] = (iaMap[ia.item_id] || 0) + 1; });
  const unassigned = items.filter(i => !iaMap[i.item_id]).length;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">👥 Assign Work</div>
        <div class="page-subtitle">Project: <strong>${Utils.esc(proj.project_name)}</strong> · ${items.length} items · ${unassigned} unassigned</div></div>
      <button class="btn btn-ghost" onclick="Router.navigate('projects')">← Back</button>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">📋 Assign Annotators</span></div>
        <div class="form-group"><label>Select Annotator</label>
          <select class="form-select" id="sel-ann">
            <option value="">-- Choose annotator --</option>
            ${annotators.map(a=>`<option value="${a.user_id}">${Utils.esc(a.full_name)}</option>`).join('')}
          </select></div>
        <div class="form-group"><label>Distribution Mode</label>
          <select class="form-select" id="dist-mode">
            <option value="all">All unassigned items</option>
            <option value="roundrobin">Round-robin across all assigned annotators</option>
            <option value="n">First N items</option>
          </select></div>
        <div class="form-group" id="n-wrap" style="display:none"><label>Number of Items</label>
          <input class="form-input" type="number" id="n-items" min="1" value="10" /></div>
        <button class="btn btn-primary w-full" onclick="Pages._doAssign('${projId}')">Assign Items</button>
        <button class="btn btn-danger w-full" style="margin-top:8px" onclick="Pages._resetAssignments('${projId}')">⚠️ Reset All Assignments & Progress</button>
        <div class="divider"></div>
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">Currently Assigned Annotators:</div>
        ${assignedAnnotators.length ? assignedAnnotators.map(u=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <div class="avatar-sm">${Utils.initials(u.full_name)}</div>
          <span style="flex:1">${Utils.esc(u.full_name)}</span>
          <span class="badge badge-muted">${DB.itemAssignments.byProject(projId).filter(ia=>ia.assigned_to===u.user_id).length} items</span>
        </div>`).join('') : '<div style="color:var(--text-2);font-size:13px">No annotators assigned yet.</div>'}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">🔍 Assign Reviewers</span></div>
        <div class="form-group"><label>Select Reviewer</label>
          <select class="form-select" id="sel-rev">
            <option value="">-- Choose reviewer --</option>
            ${reviewers.map(r=>`<option value="${r.user_id}">${Utils.esc(r.full_name)}</option>`).join('')}
          </select></div>
        <button class="btn btn-primary w-full" onclick="Pages._assignReviewer('${projId}')">Add Reviewer to Project</button>
        <div class="divider"></div>
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">Currently Assigned Reviewers:</div>
        ${assignedReviewers.length ? assignedReviewers.map(u=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <div class="avatar-sm">${Utils.initials(u.full_name)}</div>
          <span>${Utils.esc(u.full_name)}</span>
        </div>`).join('') : '<div style="color:var(--text-2);font-size:13px">No reviewers assigned yet.</div>'}
        <div class="divider"></div>
        <div class="card-header" style="margin-bottom:8px"><span class="card-title">📊 Item Assignment Status</span></div>
        ${items.slice(0,10).map(i=>{
          const cnt = iaMap[i.item_id] || 0;
          return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;border-bottom:1px solid var(--border)">
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Utils.esc((i.text||i.prompt||'—').slice(0,50))}</span>
            <span class="badge ${cnt>0?'badge-success':'badge-muted'}">${cnt} annotator${cnt!==1?'s':''}</span>
          </div>`;
        }).join('')}
        ${items.length > 10 ? `<div style="font-size:11px;color:var(--text-3);margin-top:6px">...and ${items.length-10} more</div>` : ''}
      </div>
    </div>`;
  document.getElementById('dist-mode').onchange = function () {
    document.getElementById('n-wrap').style.display = this.value === 'n' ? 'block' : 'none';
  };
};
Pages._doAssign = projId => {
  const uid = document.getElementById('sel-ann').value;
  if (!uid) { Toast.error('Please select an annotator.'); return; }
  const mode = document.getElementById('dist-mode').value;
  const items = DB.items.byProject(projId);
  const existingIAs = DB.itemAssignments.byProject(projId);
  let toAssign = items;
  if (mode === 'roundrobin') {
    const assignedAnnotators = [...new Set(DB.assignments.byProject(projId).filter(a=>a.role==='annotator').map(a=>a.user_id))];
    if (assignedAnnotators.length === 0) assignedAnnotators.push(uid);
    const newAssignments = items.filter(i => !existingIAs.some(ia => ia.item_id === i.item_id && ia.assigned_to === uid)).map((item, idx) => ({
      ia_id: Utils.uuid(), item_id: item.item_id, project_id: projId,
      assigned_to: assignedAnnotators[idx % assignedAnnotators.length],
      assigned_by: Auth.currentUser.user_id, assigned_date: Utils.now(), status: 'pending',
    }));
    DB.itemAssignments.bulkCreate(newAssignments);
    Toast.success(`${newAssignments.length} items distributed via round-robin.`);
    Pages.assignWork(projId); return;
  }
  if (mode === 'n') {
    const n = parseInt(document.getElementById('n-items').value) || 10;
    toAssign = items.filter(i => !existingIAs.some(ia => ia.item_id === i.item_id && ia.assigned_to === uid)).slice(0, n);
  } else {
    toAssign = items.filter(i => !existingIAs.some(ia => ia.item_id === i.item_id && ia.assigned_to === uid));
  }
  if (toAssign.length === 0) { Toast.warning('No new items to assign to this annotator.'); return; }
  const newIAs = toAssign.map(i => ({ ia_id: Utils.uuid(), item_id: i.item_id, project_id: projId, assigned_to: uid, assigned_by: Auth.currentUser.user_id, assigned_date: Utils.now(), status: 'pending' }));
  DB.itemAssignments.bulkCreate(newIAs);
  if (!DB.assignments.get(projId, uid)) DB.assignments.create({ assignment_id: Utils.uuid(), project_id: projId, user_id: uid, role: 'annotator', assigned_date: Utils.now(), assigned_by: Auth.currentUser.user_id });
  const annotator = DB.users.get(uid);
  Notifs.push(uid, 'assignment', 'New Items Assigned', `${toAssign.length} new items assigned to you in ${DB.projects.get(projId)?.project_name}.`);
  Toast.success(`${toAssign.length} items assigned to ${annotator?.full_name}.`);
  Pages.assignWork(projId);
};
Pages._assignReviewer = projId => {
  const uid = document.getElementById('sel-rev').value;
  if (!uid) { Toast.error('Please select a reviewer.'); return; }
  if (DB.assignments.get(projId, uid)) { Toast.warning('Reviewer already assigned.'); return; }
  DB.assignments.create({ assignment_id: Utils.uuid(), project_id: projId, user_id: uid, role: 'reviewer', assigned_date: Utils.now(), assigned_by: Auth.currentUser.user_id });
  Toast.success('Reviewer assigned!'); Pages.assignWork(projId);
};

Pages._resetAssignments = projId => {
  Modal.confirm('Reset Project Assignments & Progress', 'Are you SURE you want to completely wipe all assignments, annotations, and reviews for this project? The data items will remain, but all annotator progress will be permanently lost. (Project Roster will be kept).', () => {
    try {
      DB._set('ann_reviews', DB.reviews.all().filter(r => r.project_id !== projId));
      DB._set('ann_annotations', DB.annotations.all().filter(a => a.project_id !== projId));
      DB._set('ann_item_assignments', DB.itemAssignments.all().filter(ia => ia.project_id !== projId));
      
      Toast.success('Project assignments and progress completely reset.');
      Pages.assignWork(projId);
    } catch (e) {
      console.error('Reset error:', e);
      Toast.error('Failed to reset assignments. Check console for details.');
    }
  }, true);
};

// ── EXPORT ────────────────────────────────────────────────────
Pages.exportCenter = function () {
  const projects = DB.projects.all();
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📤 Export Center</div><div class="page-subtitle">Download annotation data for AI training</div></div>
    </div>
    <div class="card" style="max-width:700px">
      <div class="form-group"><label>Select Project</label>
        <select class="form-select" id="exp-proj">
          <option value="">-- All Projects --</option>
          ${projects.map(p=>`<option value="${p.project_id}">${Utils.esc(p.project_name)}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Status Filter</label>
        <select class="form-select" id="exp-status">
          <option value="">All statuses</option>
          <option value="accepted">Accepted only</option>
          <option value="submitted">Submitted only</option>
        </select></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">
        <button class="btn btn-primary" onclick="Pages._doExport('csv')">⬇️ Export as CSV</button>
        <button class="btn btn-secondary" onclick="Pages._doExport('json')">⬇️ Export as JSON</button>
        <button class="btn btn-secondary" onclick="Pages._doExport('jsonl')">⬇️ Export as JSONL (HuggingFace)</button>
      </div>
      <div class="divider"></div>
      <div class="card-title" style="margin-bottom:12px">📋 Export Preview</div>
      <div style="font-size:13px;color:var(--text-2);line-height:1.8">
        Export includes: <strong>ID · Text · Prompt · AI Response · Annotator Label · Reviewer Label · Final Label · Comments · Timestamps · Annotator Name · Reviewer Name · Confidence · Agreement Status</strong>
      </div>
    </div>`;
};
Pages._doExport = format => {
  const projId = document.getElementById('exp-proj').value;
  const statusFilter = document.getElementById('exp-status').value;
  let annotations = projId ? DB.annotations.byProject(projId) : DB.annotations.all();
  if (statusFilter) {
    if (statusFilter === 'accepted') {
      const acceptedAnnIds = new Set(DB.reviews.all().filter(r=>r.decision==='accepted').map(r=>r.annotation_id));
      annotations = annotations.filter(a => acceptedAnnIds.has(a.annotation_id));
    } else {
      annotations = annotations.filter(a => a.status === statusFilter);
    }
  }
  if (!annotations.length) { Toast.warning('No data matching this filter.'); return; }
  const rows = annotations.flatMap(ann => {
    const item = DB.items.get(ann.item_id) || {};
    const proj = DB.projects.get(ann.project_id) || {};
    const annotator = DB.users.get(ann.annotator_id) || {};
    const review = DB.reviews.byAnnotation(ann.annotation_id);
    const reviewer = review ? DB.users.get(review.reviewer_id) || {} : {};
    
    if (proj.task_type === 'ner') {
        const finalSpans = review?.final_spans ? JSON.parse(review.final_spans) : (ann.ner_entities ? JSON.parse(ann.ner_entities) : []);
        if (finalSpans.length === 0) {
            return [{ item_id: item.original_id || item.item_id, text: item.text||'', span_text: '', start: '', end: '', label: '', annotator: annotator.full_name||'', reviewer: reviewer.full_name||'', final_label: '' }];
        }
        return finalSpans.map(span => ({
            item_id: item.original_id || item.item_id, text: item.text || '', span_text: span.text,
            start: span.start, end: span.end, label: span.label, annotator: annotator.full_name || '',
            reviewer: reviewer.full_name || '', final_label: span.label
        }));
    } else {
        return [{
          id: item.original_id || item.item_id, text: item.text || '', prompt: item.prompt || '',
          ai_response: item.ai_response || '', response_a: item.response_a || '', response_b: item.response_b || '',
          annotator_name: annotator.full_name || '', annotator_label: ann.annotator_label || '',
          annotator_comment: ann.annotator_comment || '', confidence: ann.confidence_level || '',
          annotation_timestamp: ann.created_timestamp || '',
          reviewer_name: reviewer.full_name || '', reviewer_label: review?.reviewer_label || '',
          reviewer_comment: review?.reviewer_comment || '', final_label: review?.final_label || ann.annotator_label || '',
          review_decision: review?.decision || '', review_timestamp: review?.review_timestamp || '',
          project_id: ann.project_id,
        }];
    }
  });

  const ts = new Date().toISOString().slice(0,10);
  if (format === 'csv') Utils.downloadCSV(rows, `annotateai_export_${ts}.csv`);
  else if (format === 'json') {
      const jsonOutput = annotations.map(ann => {
          const item = DB.items.get(ann.item_id) || {};
          const proj = DB.projects.get(ann.project_id) || {};
          const annotator = DB.users.get(ann.annotator_id) || {};
          const review = DB.reviews.byAnnotation(ann.annotation_id);
          if (proj.task_type === 'ner') {
             const finalSpans = review?.final_spans ? JSON.parse(review.final_spans) : (ann.ner_entities ? JSON.parse(ann.ner_entities) : []);
             return { item_id: item.original_id || item.item_id, text: item.text, spans: finalSpans, annotator: annotator.full_name, timestamp: ann.created_timestamp };
          }
          return rows.find(r => r.id === (item.original_id || item.item_id)); // Fallback JSON object
      });
      Utils.downloadJSON(jsonOutput, `annotateai_export_${ts}.json`);
  }
  else {
    const jsonl = annotations.map(ann => {
        const item = DB.items.get(ann.item_id) || {};
        const proj = DB.projects.get(ann.project_id) || {};
        const annotator = DB.users.get(ann.annotator_id) || {};
        const review = DB.reviews.byAnnotation(ann.annotation_id);
        const reviewer = review ? DB.users.get(review.reviewer_id) || {} : {};
        if (proj.task_type === 'ner') {
             const finalSpans = review?.final_spans ? JSON.parse(review.final_spans) : (ann.ner_entities ? JSON.parse(ann.ner_entities) : []);
             return JSON.stringify({ item_id: item.original_id || item.item_id, text: item.text, spans: finalSpans, annotator: annotator.full_name, timestamp: ann.created_timestamp });
        }
        const finalLabel = review?.final_label || ann.annotator_label || '';
        return JSON.stringify({ prompt: item.prompt || item.text, response_a: item.response_a, response_b: item.response_b, ai_response: item.ai_response, label: finalLabel, metadata: { annotator: annotator.full_name, reviewer: reviewer.full_name || '' } });
    }).join('\n');
    Utils.download(jsonl, `annotateai_export_${ts}.jsonl`, 'application/jsonlines');
  }
  Toast.success(`${rows.length} records exported as ${format.toUpperCase()}.`);
};

// ── SETTINGS ──────────────────────────────────────────────────
Pages.settings = function () {
  const s = DB.settings.get();
  document.getElementById('main-content').innerHTML = `
    <div class="page-header"><div><div class="page-title">⚙️ Settings</div><div class="page-subtitle">System configuration</div></div></div>
    <div class="card" style="max-width:600px">
      <div class="form-group"><label>Minimum Annotators Per Item</label>
        <select class="form-select" id="s-ann"><option value="1" ${s.min_annotators==1?'selected':''}>1 annotator</option><option value="2" ${s.min_annotators==2?'selected':''}>2 annotators</option><option value="3" ${s.min_annotators==3?'selected':''}>3 annotators (recommended)</option></select></div>
      <div class="form-group"><label>Session Timeout (minutes, 0 = never)</label>
        <input class="form-input" type="number" id="s-timeout" min="0" value="${s.session_timeout}" /></div>
      <div class="form-group"><label style="display:flex;align-items:center;gap:10px">
        <input type="checkbox" id="s-blind" ${s.blind_review?'checked':''} style="width:16px;height:16px" />
        Enable Blind Review Mode by default (reviewers don't see annotator name)
      </label></div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="Pages._saveSettings()">Save Settings</button>
      </div>
      <div class="divider"></div>
      <div class="card-title mb-2">🔄 Data Management</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn btn-secondary" onclick="Pages._backupData()">⬇️ Backup All Data</button>
        <button class="btn btn-secondary" onclick="document.getElementById('restore-file').click()">📂 Restore from Backup</button>
        <input type="file" id="restore-file" accept=".json" style="display:none" onchange="Pages._restoreData(this.files[0])" />
        <button class="btn btn-danger" onclick="Pages._clearData()">🗑️ Clear All Data</button>
      </div>
      <div style="font-size:12px;color:var(--text-3);line-height:1.6">
        <strong style="color:var(--text-2)">Backup</strong> downloads a full JSON snapshot of all data.<br/>
        <strong style="color:var(--text-2)">Restore</strong> uploads a backup JSON file and replaces all current data. This cannot be undone.
      </div>
    </div>`;
};
Pages._saveSettings = () => {
  DB.settings.set({ min_annotators: parseInt(document.getElementById('s-ann').value), session_timeout: parseInt(document.getElementById('s-timeout').value) || 30, blind_review: document.getElementById('s-blind').checked });
  Toast.success('Settings saved.');
};
Pages._backupData = () => {
  const backup = { users: DB.users.all(), projects: DB.projects.all(), items: DB.items.all(), annotations: DB.annotations.all(), reviews: DB.reviews.all(), assignments: DB.assignments.all(), itemAssignments: DB.itemAssignments.all(), history: DB.history.all(), notifications: DB.notifications.all(), settings: DB.settings.get(), exportedAt: Utils.now(), version: '1.0' };
  Utils.downloadJSON(backup, `annotateai_backup_${new Date().toISOString().slice(0,10)}.json`);
  Toast.success('Backup downloaded.');
};
Pages._restoreData = (file) => {
  if (!file) return;
  Modal.confirm(
    '📂 Restore from Backup',
    'This will <strong>replace all current data</strong> with the backup file contents. All existing projects, annotations, and reviews will be overwritten. This cannot be undone.\n\nAre you sure?',
    () => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.users || !data.projects) { Toast.error('Invalid backup file. Missing required data.'); return; }
          const keys = ['users','projects','items','annotations','reviews','assignments','itemAssignments','history','notifications'];
          const storeMap = { users:'ann_users', projects:'ann_projects', items:'ann_items', annotations:'ann_annotations', reviews:'ann_reviews', assignments:'ann_assignments', itemAssignments:'ann_item_assignments', history:'ann_history', notifications:'ann_notifications' };
          keys.forEach(k => { if (Array.isArray(data[k])) localStorage.setItem(storeMap[k], JSON.stringify(data[k])); });
          if (data.settings) DB.settings.set(data.settings);
          const counts = keys.map(k => (data[k]||[]).length);
          Toast.success(`Restore complete — ${counts[0]} users, ${counts[1]} projects, ${counts[2]} items, ${counts[3]} annotations.`);
          setTimeout(() => Router.navigate('dashboard'), 800);
        } catch (err) {
          Toast.error('Failed to parse backup file: ' + err.message);
        }
      };
      reader.readAsText(file);
    },
    true
  );
  // Reset file input so the same file can be selected again
  document.getElementById('restore-file').value = '';
};
Pages._clearData = () => Modal.confirm('Clear All Data', 'This will delete ALL projects, items, annotations and reviews. Users will be kept. Cannot be undone!', () => {
  ['ann_projects','ann_items','ann_annotations','ann_reviews','ann_assignments','ann_item_assignments','ann_history','ann_notifications'].forEach(k => localStorage.removeItem(k));
  Toast.success('All data cleared.'); Router.navigate('dashboard');
}, true);
