'use strict';
// ============================================================
// AUTH
// ============================================================
const Auth = {
  currentUser: null,
  login(username, password) {
    const user = DB.users.byUsername(username.trim());
    if (!user) return { ok: false, msg: 'Username not found.' };
    if (!user.is_active) return { ok: false, msg: 'Account is deactivated. Contact Admin.' };
    if (user.password !== password) return { ok: false, msg: 'Incorrect password.' };
    Auth.currentUser = user;
    DB.session.set({ user_id: user.user_id, role: user.role });
    DB.users.update(user.user_id, { last_login: Utils.now() });
    return { ok: true, user };
  },
  logout() {
    Auth.currentUser = null;
    DB.session.clear();
    document.getElementById('view-app').classList.add('hidden');
    document.getElementById('view-login').classList.remove('hidden');
    Pages.login();
  },
  restore() {
    if (!DB.session.valid()) return false;
    const s = DB.session.get();
    Auth.currentUser = DB.users.get(s.user_id);
    return !!Auth.currentUser;
  },
  is(role) { return Auth.currentUser?.role === role; },
  isAny(...roles) { return roles.includes(Auth.currentUser?.role); },
};
