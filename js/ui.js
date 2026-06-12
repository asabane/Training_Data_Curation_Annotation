'use strict';
// ============================================================
// UI: Toast, Modal, Notifications, Router, Layout
// ============================================================

// ── TOAST ────────────────────────────────────────────────────
const Toast = {
  show(msg, type = 'info', title = '', duration = 4200) {
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const titles = { success:'Success', error:'Error', warning:'Warning', info:'Info' };
    const id = Utils.uuid();
    const el = document.createElement('div');
    el.className = `toast ${type}`; el.id = id;
    el.innerHTML = `<span class="toast-icon">${icons[type]}</span>
      <div class="toast-body"><div class="toast-title">${title || titles[type]}</div>${msg ? `<div class="toast-msg">${msg}</div>` : ''}</div>
      <span class="toast-close" onclick="document.getElementById('${id}').remove()">✕</span>`;
    document.getElementById('toast-container').appendChild(el);
    if (duration > 0) setTimeout(() => el.remove(), duration);
  },
  success(msg, title) { Toast.show(msg, 'success', title); },
  error(msg, title) { Toast.show(msg, 'error', title); },
  warning(msg, title) { Toast.show(msg, 'warning', title); },
  info(msg, title) { Toast.show(msg, 'info', title); },
};

// ── MODAL ─────────────────────────────────────────────────────
const Modal = {
  show(html, size = '') {
    document.getElementById('modal-container').innerHTML = `<div class="modal ${size}">${html}</div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-overlay').onclick = e => { if (e.target.id === 'modal-overlay') Modal.hide(); };
  },
  hide() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-container').innerHTML = '';
  },
  confirm(title, msg, onYes, danger = false) {
    Modal.show(`<div class="modal-header"><span class="modal-title">${title}</span><span class="modal-close" onclick="Modal.hide()">✕</span></div>
      <p style="color:var(--text-2);font-size:14px;line-height:1.6">${msg}</p>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="Modal.hide()">Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="mc-yes">Confirm</button>
      </div>`);
    document.getElementById('mc-yes').onclick = () => { Modal.hide(); onYes(); };
  },
};

// ── NOTIFICATIONS ─────────────────────────────────────────────
const Notifs = {
  push(userId, type, title, message, refId = '') {
    DB.notifications.create({ notification_id: Utils.uuid(), user_id: userId, type, title, message, is_read: false, reference_id: refId, created_date: Utils.now() });
    Notifs.updateBadge();
  },
  updateBadge() {
    if (!Auth.currentUser) return;
    const n = DB.notifications.unread(Auth.currentUser.user_id);
    const dot = document.getElementById('notif-dot');
    if (dot) dot.classList.toggle('hidden', n === 0);
  },
  toggle() {
    const dd = document.getElementById('notif-dropdown');
    if (dd.classList.contains('hidden')) { Notifs.render(); dd.classList.remove('hidden'); }
    else dd.classList.add('hidden');
  },
  render() {
    if (!Auth.currentUser) return;
    const list = DB.notifications.forUser(Auth.currentUser.user_id).slice(0, 25);
    const icons = { rejection:'❌', assignment:'📋', approval:'✅', reminder:'⏰', system:'⚙️', milestone:'🎯', edit:'✏️' };
    document.getElementById('notif-dropdown').innerHTML = `
      <div class="notif-header"><span class="notif-title">🔔 Notifications</span>
        <button class="btn btn-ghost btn-sm" onclick="Notifs.markAllRead()">Mark all read</button></div>
      <div class="notif-list">${list.length === 0 ? '<div class="notif-empty">No notifications yet</div>' :
        list.map(n => `<div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="Notifs.markRead('${n.notification_id}')">
          <div class="notif-item-icon">${icons[n.type] || '📢'}</div>
          <div class="notif-item-body">
            <div class="notif-item-title">${Utils.esc(n.title)}</div>
            <div class="notif-item-msg">${Utils.esc(n.message)}</div>
            <div class="notif-item-time">${Utils.timeAgo(n.created_date)}</div>
          </div></div>`).join('')}</div>`;
  },
  markRead(id) { DB.notifications.markRead(id); Notifs.updateBadge(); Notifs.render(); },
  markAllRead() { DB.notifications.markAllRead(Auth.currentUser.user_id); Notifs.updateBadge(); Notifs.render(); },
};

// ── ROUTER ────────────────────────────────────────────────────
const Router = {
  params: {},
  navigate(page, params = {}) {
    Router.params = params;
    document.getElementById('notif-dropdown').classList.add('hidden');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    const titles = { dashboard:'Dashboard', users:'User Management', 'create-user':'Create User', 'edit-user':'Edit User',
      projects:'Projects', 'create-project':'Create Project', 'edit-project':'Edit Project',
      'upload-data':'Upload Data', 'assign-work':'Assign Work', export:'Export Center',
      settings:'Settings', queue:'My Annotation Queue', annotate:'Annotate Item',
      submissions:'My Submissions', 'review-queue':'Review Queue', review:'Review Item',
      iaa:'IAA Analysis', 'gold-standard':'Gold Standard Items', conflicts:'Conflict Queue', performance:'Annotator Performance',
      analytics:'Analytics Dashboard', 'activity-log':'Activity Log', help:'User Guide' };
    const bc = document.getElementById('topbar-breadcrumb');
    if (bc) bc.innerHTML = `<strong>${titles[page] || page}</strong>`;
    const mc = document.getElementById('main-content');
    mc.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-2)">⏳ Loading...</div>';
    setTimeout(() => {
      const P = Pages;
      const routes = { dashboard: () => P.dashboard(), users: () => P.users(), 'create-user': () => P.createUser(),
        'edit-user': () => P.editUser(params.id), projects: () => P.projects(), 'create-project': () => P.createProject(),
        'edit-project': () => P.editProject(params.id), 'upload-data': () => P.uploadData(params.id),
        'assign-work': () => P.assignWork(params.id), export: () => P.exportCenter(),
        settings: () => P.settings(), queue: () => P.queue(), annotate: () => P.annotate(params.itemId, params.iaId),
        submissions: () => P.submissions(), 'review-queue': () => P.reviewQueue(), review: () => P.review(params.annotationId),
        iaa: () => P.iaa(), 'gold-standard': () => P.goldStandard(), conflicts: () => P.conflicts(), performance: () => P.performance(),
        analytics: () => P.analytics(), 'activity-log': () => P.activityLog(), help: () => P.help() };
      try {
        (routes[page] || routes.dashboard)();
      } catch (err) {
        console.error('Router error on page:', page, err);
        document.getElementById('main-content').innerHTML = `
          <div style="padding:40px;color:var(--danger)">
            <div style="font-size:18px;font-weight:700;margin-bottom:12px">⚠️ Page Error</div>
            <pre style="font-size:12px;background:var(--bg-elevated);padding:16px;border-radius:8px;overflow:auto;color:var(--text-2)">${Utils.esc(String(err))}\n\n${Utils.esc(err?.stack || '')}</pre>
          </div>`;
      }
    }, 20);
  },
};

// ── LAYOUT ────────────────────────────────────────────────────
const Layout = {
  show() {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('view-app').classList.remove('hidden');
    Layout.renderSidebar();
    Layout.renderUserCard();
    Notifs.updateBadge();
    document.getElementById('logout-btn').onclick = () => { if (typeof Session !== 'undefined') Session.stop(); Auth.logout(); };
    document.getElementById('notif-btn').onclick = Notifs.toggle;
    document.addEventListener('click', e => {
      if (!e.target.closest('#notif-btn') && !e.target.closest('#notif-dropdown'))
        document.getElementById('notif-dropdown').classList.add('hidden');
    });
    if (typeof Session !== 'undefined') Session.start();
  },
  renderSidebar() {
    const role = Auth.currentUser?.role;
    const sections = [{ label: 'Overview', items: [{ icon: '📊', label: 'Dashboard', page: 'dashboard' }] }];
    if (role === 'admin') {
      sections.push({ label: 'Administration', items: [
        { icon: '👥', label: 'Users', page: 'users' },
        { icon: '📁', label: 'Projects', page: 'projects' },
        { icon: '📤', label: 'Export Center', page: 'export' },
        { icon: '⚙️', label: 'Settings', page: 'settings' },
      ]});
      sections.push({ label: 'Quality Control', items: [
        { icon: '🤝', label: 'IAA Analysis', page: 'iaa' },
        { icon: '🏆', label: 'Gold Standard', page: 'gold-standard' },
        { icon: '⚖️', label: 'Conflict Queue', page: 'conflicts' },
        { icon: '📈', label: 'Performance', page: 'performance' },
      ]});
      sections.push({ label: 'Insights', items: [
        { icon: '📊', label: 'Analytics', page: 'analytics' },
        { icon: '📋', label: 'Activity Log', page: 'activity-log' },
      ]});
    }
    if (Auth.isAny('annotator', 'admin')) {
      sections.push({ label: 'Annotation', items: [
        { icon: '✏️', label: 'My Queue', page: 'queue' },
        { icon: '📝', label: 'My Submissions', page: 'submissions' },
      ]});
    }
    if (Auth.isAny('reviewer', 'admin')) {
      sections.push({ label: 'Review', items: [
        { icon: '🔍', label: 'Review Queue', page: 'review-queue' },
      ]});
    }
    sections.push({ label: 'Support', items: [
      { icon: '❓', label: 'User Guide', page: 'help' },
    ]});
    document.getElementById('sidebar-nav').innerHTML = sections.map(s => `
      <div class="nav-section">
        <div class="nav-section-label">${s.label}</div>
        ${s.items.map(it => `<div class="nav-item" data-page="${it.page}" onclick="Router.navigate('${it.page}')">
          <span class="nav-icon">${it.icon}</span>${it.label}</div>`).join('')}
      </div>`).join('');
  },
  renderUserCard() {
    const u = Auth.currentUser;
    if (!u) return;
    document.getElementById('user-card').innerHTML = `
      <div class="user-avatar">${Utils.initials(u.full_name)}</div>
      <div class="user-info"><div class="user-name">${Utils.esc(u.full_name)}</div>
        <div class="user-role">${u.role}</div></div>`;
  },
};
