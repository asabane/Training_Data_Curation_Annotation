'use strict';
// ============================================================
// DATABASE LAYER (localStorage CRUD)
// ============================================================
const DB = {
  _get(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } },
  _set(key, d) { localStorage.setItem(key, JSON.stringify(d)); },
  _getObj(key, def = {}) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); } catch { return def; } },
  _setObj(key, d) { localStorage.setItem(key, JSON.stringify(d)); },

  users: {
    all() { return DB._get('ann_users'); },
    get(id) { return DB.users.all().find(u => u.user_id === id) || null; },
    byUsername(u) { return DB.users.all().find(x => x.username === u) || null; },
    byRole(r) { return DB.users.all().filter(u => u.role === r && u.is_active); },
    create(d) { const a = DB.users.all(); a.push(d); DB._set('ann_users', a); return d; },
    update(id, ch) { const a = DB.users.all(); const i = a.findIndex(u => u.user_id === id); if (i >= 0) { a[i] = { ...a[i], ...ch }; DB._set('ann_users', a); } },
    delete(id) { DB._set('ann_users', DB.users.all().filter(u => u.user_id !== id)); },
  },

  projects: {
    all() { return DB._get('ann_projects'); },
    get(id) { return DB.projects.all().find(p => p.project_id === id) || null; },
    create(d) { const a = DB.projects.all(); a.push(d); DB._set('ann_projects', a); return d; },
    update(id, ch) { const a = DB.projects.all(); const i = a.findIndex(p => p.project_id === id); if (i >= 0) { a[i] = { ...a[i], ...ch }; DB._set('ann_projects', a); } },
    delete(id) { DB._set('ann_projects', DB.projects.all().filter(p => p.project_id !== id)); },
  },

  items: {
    all() { return DB._get('ann_items'); },
    get(id) { return DB.items.all().find(i => i.item_id === id) || null; },
    byProject(pid) { return DB.items.all().filter(i => i.project_id === pid); },
    create(d) { const a = DB.items.all(); a.push(d); DB._set('ann_items', a); return d; },
    bulkCreate(arr) { const a = DB.items.all(); a.push(...arr); DB._set('ann_items', a); },
    update(id, ch) { const a = DB.items.all(); const i = a.findIndex(x => x.item_id === id); if (i >= 0) { a[i] = { ...a[i], ...ch }; DB._set('ann_items', a); } },
    delete(id) { DB._set('ann_items', DB.items.all().filter(i => i.item_id !== id)); },
  },

  assignments: {
    all() { return DB._get('ann_assignments'); },
    byProject(pid) { return DB.assignments.all().filter(a => a.project_id === pid); },
    byUser(uid) { return DB.assignments.all().filter(a => a.user_id === uid); },
    get(pid, uid) { return DB.assignments.all().find(a => a.project_id === pid && a.user_id === uid) || null; },
    create(d) { const a = DB.assignments.all(); a.push(d); DB._set('ann_assignments', a); return d; },
    delete(id) { DB._set('ann_assignments', DB.assignments.all().filter(a => a.assignment_id !== id)); },
  },

  itemAssignments: {
    all() { return DB._get('ann_item_assignments'); },
    byUser(uid) { return DB.itemAssignments.all().filter(a => a.assigned_to === uid); },
    byItem(iid) { return DB.itemAssignments.all().filter(a => a.item_id === iid); },
    byProject(pid) { return DB.itemAssignments.all().filter(a => a.project_id === pid); },
    get(id) { return DB.itemAssignments.all().find(a => a.ia_id === id) || null; },
    create(d) { const a = DB.itemAssignments.all(); a.push(d); DB._set('ann_item_assignments', a); return d; },
    bulkCreate(arr) { const a = DB.itemAssignments.all(); a.push(...arr); DB._set('ann_item_assignments', a); },
    update(id, ch) { const a = DB.itemAssignments.all(); const i = a.findIndex(x => x.ia_id === id); if (i >= 0) { a[i] = { ...a[i], ...ch }; DB._set('ann_item_assignments', a); } },
    delete(id) { DB._set('ann_item_assignments', DB.itemAssignments.all().filter(a => a.ia_id !== id)); },
  },

  annotations: {
    all() { return DB._get('ann_annotations'); },
    get(id) { return DB.annotations.all().find(a => a.annotation_id === id) || null; },
    byItem(iid) { return DB.annotations.all().filter(a => a.item_id === iid); },
    byUser(uid) { return DB.annotations.all().filter(a => a.annotator_id === uid); },
    byProject(pid) { return DB.annotations.all().filter(a => a.project_id === pid); },
    byItemAndUser(iid, uid) { return DB.annotations.all().find(a => a.item_id === iid && a.annotator_id === uid) || null; },
    create(d) { const a = DB.annotations.all(); a.push(d); DB._set('ann_annotations', a); return d; },
    update(id, ch) { const a = DB.annotations.all(); const i = a.findIndex(x => x.annotation_id === id); if (i >= 0) { a[i] = { ...a[i], ...ch }; DB._set('ann_annotations', a); } },
    delete(id) { DB._set('ann_annotations', DB.annotations.all().filter(a => a.annotation_id !== id)); },
  },

  history: {
    all() { return DB._get('ann_history'); },
    byAnnotation(aid) { return DB.history.all().filter(h => h.annotation_id === aid); },
    create(d) { const a = DB.history.all(); a.push(d); DB._set('ann_history', a); return d; },
  },

  reviews: {
    all() { return DB._get('ann_reviews'); },
    get(id) { return DB.reviews.all().find(r => r.review_id === id) || null; },
    byAnnotation(aid) { return DB.reviews.all().find(r => r.annotation_id === aid) || null; },
    byProject(pid) { return DB.reviews.all().filter(r => r.project_id === pid); },
    byReviewer(uid) { return DB.reviews.all().filter(r => r.reviewer_id === uid); },
    create(d) { const a = DB.reviews.all(); a.push(d); DB._set('ann_reviews', a); return d; },
    update(id, ch) { const a = DB.reviews.all(); const i = a.findIndex(r => r.review_id === id); if (i >= 0) { a[i] = { ...a[i], ...ch }; DB._set('ann_reviews', a); } },
    delete(id) { DB._set('ann_reviews', DB.reviews.all().filter(r => r.review_id !== id)); },
  },

  notifications: {
    all() { return DB._get('ann_notifications'); },
    forUser(uid) { return DB.notifications.all().filter(n => n.user_id === uid).sort((a, b) => new Date(b.created_date) - new Date(a.created_date)); },
    unread(uid) { return DB.notifications.forUser(uid).filter(n => !n.is_read).length; },
    create(d) { const a = DB.notifications.all(); a.push(d); DB._set('ann_notifications', a); return d; },
    markRead(id) { const a = DB.notifications.all(); const i = a.findIndex(n => n.notification_id === id); if (i >= 0) { a[i].is_read = true; DB._set('ann_notifications', a); } },
    markAllRead(uid) { DB._set('ann_notifications', DB.notifications.all().map(n => n.user_id === uid ? { ...n, is_read: true } : n)); },
  },

  settings: {
    get() { return DB._getObj('ann_settings', { min_annotators: 3, session_timeout: 30, blind_review: false, app_name: 'AnnotateAI' }); },
    set(ch) { DB._setObj('ann_settings', { ...DB.settings.get(), ...ch }); },
  },

  session: {
    get() { return DB._getObj('ann_session', null); },
    set(d) { const to = DB.settings.get().session_timeout; DB._setObj('ann_session', { ...d, expires: Date.now() + to * 60 * 1000 }); },
    clear() { localStorage.removeItem('ann_session'); },
    valid() { const s = DB.session.get(); if (!s?.user_id) return false; const to = DB.settings.get().session_timeout; return to === 0 || Date.now() < s.expires; },
    touch() { const s = DB.session.get(); if (s) DB.session.set(s); },
  },
};
