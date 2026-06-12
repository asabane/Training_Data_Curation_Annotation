'use strict';
// ============================================================
// SESSION TIMEOUT + DEADLINE REMINDERS
// ============================================================
const Session = {
  _timer: null,
  _deadlineTimer: null,
  _warningShown: false,

  start() {
    Session._track();
    if (Session._timer) clearInterval(Session._timer);
    Session._timer = setInterval(() => Session._check(), 30000);
    setTimeout(() => Session._checkDeadlines(), 1500);
    // Re-check deadlines every 24 h in case the tab stays open overnight
    if (Session._deadlineTimer) clearInterval(Session._deadlineTimer);
    Session._deadlineTimer = setInterval(() => Session._checkDeadlines(), 86400000);
  },

  stop() {
    if (Session._timer) { clearInterval(Session._timer); Session._timer = null; }
    if (Session._deadlineTimer) { clearInterval(Session._deadlineTimer); Session._deadlineTimer = null; }
    localStorage.removeItem('ann_last_activity');
    Session._warningShown = false;
    const bar = document.getElementById('session-warn-bar');
    if (bar) bar.remove();
  },

  _touch() {
    localStorage.setItem('ann_last_activity', Date.now().toString());
    if (Session._warningShown) {
      Session._warningShown = false;
      const bar = document.getElementById('session-warn-bar');
      if (bar) bar.remove();
    }
  },

  _track() {
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(e =>
      document.addEventListener(e, Session._touch, { passive: true }));
    Session._touch();
  },

  _check() {
    if (!Auth.currentUser) return;
    const timeout = DB.settings.get().session_timeout;
    if (!timeout || timeout === 0) return;
    const last = parseInt(localStorage.getItem('ann_last_activity') || '0');
    const elapsedMin = (Date.now() - last) / 60000;
    if (elapsedMin >= timeout) {
      Session.stop();
      Toast.warning('You have been logged out due to inactivity.', 'Session Expired');
      Auth.logout();
    } else if (elapsedMin >= timeout - 2 && !Session._warningShown) {
      Session._warningShown = true;
      const minsLeft = Math.ceil(timeout - elapsedMin);
      Session._showWarning(minsLeft);
    }
  },

  _showWarning(minsLeft) {
    const existing = document.getElementById('session-warn-bar');
    if (existing) existing.remove();
    const bar = document.createElement('div');
    bar.id = 'session-warn-bar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#f59e0b;color:#000;text-align:center;padding:10px 16px;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:12px';
    bar.innerHTML = `⚠️ Session expiring in ~${minsLeft} minute${minsLeft !== 1 ? 's' : ''}. Move your mouse or press any key to stay logged in.
      <button onclick="document.getElementById('session-warn-bar').remove();Session._touch();Session._warningShown=false"
        style="background:rgba(0,0,0,0.2);border:none;padding:3px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">
        Dismiss ✕
      </button>`;
    document.body.appendChild(bar);
  },

  _checkDeadlines() {
    if (!Auth.currentUser) return;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const projects = DB.projects.all().filter(p => p.deadline && p.status === 'active');
    projects.forEach(proj => {
      const dl = new Date(proj.deadline);
      const daysLeft = Math.ceil((dl - today) / 86400000);
      if (daysLeft < 0 || daysLeft > 7) return;
      const key = `dl_notif_${proj.project_id}_${todayStr}_${Auth.currentUser.user_id}`;
      if (localStorage.getItem(key)) return;
      const assigned = DB.assignments.byProject(proj.project_id).some(a => a.user_id === Auth.currentUser.user_id);
      if (!assigned && Auth.currentUser.role !== 'admin') return;
      const msg = daysLeft === 0
        ? `Deadline is TODAY for "${proj.project_name}"! Please complete your work.`
        : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left for "${proj.project_name}" (due ${Utils.formatDate(proj.deadline)}).`;
      Notifs.push(Auth.currentUser.user_id, 'reminder', `⏰ Deadline Approaching`, msg, proj.project_id);
      localStorage.setItem(key, '1');
    });
  },
};
