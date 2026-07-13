/* BESTWAY EC — admin panel.
   Backendning o'zi beradi: http://<host>/admin
   Faqat admin va super_admin kira oladi. */

const API = location.origin + '/v1';
const MONTHS = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'];
const ROLE_UZ = { super_admin: 'Super admin', admin: 'Admin', teacher: "O'qituvchi", student: "O'quvchi", parent: 'Ota-ona' };

const store = {
  get access() { return localStorage.getItem('access'); },
  set access(v) { v ? localStorage.setItem('access', v) : localStorage.removeItem('access'); },
  get refresh() { return localStorage.getItem('refresh'); },
  set refresh(v) { v ? localStorage.setItem('refresh', v) : localStorage.removeItem('refresh'); },
};

let me = null;
let settings = { teacherPointLimit: 20, initialPoints: 100, monthlyFee: 0, gameThreshold: 150 };
let groupsCache = [];

/* ---------------- Yordamchilar ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const view = () => $('#view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (Number(n) || 0).toLocaleString('uz-UZ') + " so'm";
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStr = () => todayStr().slice(0, 7);
const initials = (name) =>
  String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('');
const avatarHtml = (t) =>
  t.photoUrl
    ? `<img class="tavatar" src="${esc(t.photoUrl)}" alt="" loading="lazy" />`
    : `<span class="tavatar tavatar-ph">${esc(initials(t.name))}</span>`;

function toast(text, kind = '') {
  const t = $('#toast');
  t.textContent = text;
  t.className = 'show ' + kind;
  setTimeout(() => (t.className = ''), 2600);
}

/** Barcha so'rovlar shu yerdan o'tadi: token, refresh, xatolik */
async function api(path, { method = 'GET', body, raw = false, retry = true } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(store.access ? { Authorization: 'Bearer ' + store.access } : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && store.refresh) {
    const ok = await tryRefresh();
    if (ok) return api(path, { method, body, raw, retry: false });
  }
  if (raw) {
    if (!res.ok) throw new Error('Yuklab bo\'lmadi');
    return res;
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    if (res.status === 401) logout();
    throw new Error(json?.error?.message || `Xatolik (${res.status})`);
  }
  return json;
}

async function tryRefresh() {
  try {
    const res = await fetch(API + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: store.refresh }),
    });
    const json = await res.json();
    if (!json.success) return false;
    store.access = json.data.accessToken;
    return true;
  } catch { return false; }
}

/** CSV yuklab olish (Authorization header kerak, shuning uchun oddiy havola ishlamaydi) */
async function download(path, filename) {
  try {
    const res = await api(path, { raw: true });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast('Yuklab olindi', 'ok');
  } catch (e) { toast(e.message, 'bad'); }
}

function modal(title, htmlBody, onSubmit) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal-bg"><form class="modal"><h2>${esc(title)}</h2>${htmlBody}
    <p class="error" data-err></p>
    <div class="row" style="margin-top:8px"><span class="spacer"></span>
      <button type="button" data-close>Bekor qilish</button>
      <button type="submit" class="primary">Saqlash</button></div></form></div>`;

  const close = () => (root.innerHTML = '');
  $('[data-close]', root).addEventListener('click', close);
  $('.modal-bg', root).addEventListener('click', (e) => { if (e.target.classList.contains('modal-bg')) close(); });
  $('form', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', root);
    btn.disabled = true;
    try {
      await onSubmit(new FormData(e.target));
      close();
    } catch (err) {
      $('[data-err]', root).textContent = err.message;
      btn.disabled = false;
    }
  });
  return close;
}

function confirmDialog(text, onYes) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal-bg"><div class="modal"><h2>Tasdiqlang</h2><p>${esc(text)}</p>
    <div class="row" style="margin-top:14px"><span class="spacer"></span>
    <button data-no>Yo'q</button><button class="primary" data-yes>Ha</button></div></div></div>`;
  $('[data-no]', root).addEventListener('click', () => (root.innerHTML = ''));
  $('[data-yes]', root).addEventListener('click', async () => {
    root.innerHTML = '';
    try { await onYes(); } catch (e) { toast(e.message, 'bad'); }
  });
}

/* ---------------- Kirish ---------------- */

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginError').textContent = '';
  try {
    const res = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: $('#phone').value.trim(), password: $('#password').value }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error.message);
    if (!['admin', 'super_admin'].includes(json.data.user.role)) {
      throw new Error('Bu panel faqat administratorlar uchun');
    }
    store.access = json.data.accessToken;
    store.refresh = json.data.refreshToken;
    await boot();
  } catch (err) {
    $('#loginError').textContent = err.message;
  }
});

$('#logoutBtn').addEventListener('click', logout);

function logout() {
  store.access = null;
  store.refresh = null;
  me = null;
  $('#app').classList.remove('show');
  $('#login').style.display = 'grid';
}

/* ---------------- Karkas ---------------- */

const PAGES = [
  { id: 'dashboard', ico: '📊', title: 'Bosh sahifa' },
  { id: 'students', ico: '👨‍🎓', title: "O'quvchilar" },
  { id: 'staff', ico: '👔', title: 'Xodimlar' },
  { id: 'groups', ico: '👥', title: 'Guruhlar' },
  { sep: true },
  { id: 'attendance', ico: '📅', title: 'Davomat' },
  { id: 'payments', ico: '💰', title: "To'lovlar" },
  { id: 'points', ico: '🏆', title: 'Ballar' },
  { id: 'game', ico: '🎮', title: "O'yin" },
  { sep: true },
  { id: 'grading', ico: '✍️', title: 'Baholash' },
  { id: 'videos', ico: '🎬', title: 'Videolar' },
  { id: 'articles', ico: '📰', title: 'Maqolalar' },
  { id: 'teachers', ico: '🧑‍🏫', title: "Sayt o'qituvchilari" },
  { id: 'broadcast', ico: '📢', title: 'Xabar yuborish' },
  { sep: true },
  { id: 'settings', ico: '⚙️', title: 'Sozlamalar' },
  { id: 'audit', ico: '🔍', title: 'Audit jurnali', superOnly: true },
];

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = PAGES.filter((p) => !p.superOnly || me.role === 'super_admin')
    .map((p) => (p.sep ? '<div class="sep"></div>' : `<button data-page="${p.id}"><span class="ico">${p.ico}</span>${p.title}</button>`))
    .join('');
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (btn) go(btn.dataset.page);
  });
}

const routes = {};
let current = null;

async function go(page) {
  current = page;
  document.querySelectorAll('#nav [data-page]').forEach((b) => b.classList.toggle('active', b.dataset.page === page));

  // Eski hodisa tinglovchilari to'planib qolmasligi uchun #view ni yangisiga almashtiramiz
  const old = view();
  old.replaceWith(old.cloneNode(false));
  view().innerHTML = '<div class="empty">Yuklanmoqda…</div>';
  try {
    await routes[page]();
  } catch (e) {
    view().innerHTML = `<div class="card"><p class="error">${esc(e.message)}</p></div>`;
  }
  location.hash = page;
}

function page(title, subtitle, actionsHtml = '') {
  return `<header class="page"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="row">${actionsHtml}</div></header>`;
}

async function boot() {
  const meRes = await api('/auth/me');
  me = meRes.data.user;
  if (!['admin', 'super_admin'].includes(me.role)) return logout();

  settings = (await api('/settings')).data;
  groupsCache = (await api('/groups')).data;

  $('#login').style.display = 'none';
  $('#app').classList.add('show');
  $('#meName').textContent = me.name;
  $('#meRole').textContent = ROLE_UZ[me.role];
  renderNav();
  go(location.hash.slice(1) in routes ? location.hash.slice(1) : 'dashboard');
}

/* ---------------- Bosh sahifa ---------------- */

routes.dashboard = async () => {
  const [d, income] = await Promise.all([api('/stats/dashboard'), api('/stats/income?months=6')]);
  const s = d.data;
  const t = s.today;
  const max = Math.max(1, ...income.data.map((i) => i.income));

  const stat = (label, value, sub = '') =>
    `<div class="card stat"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;

  view().innerHTML = page('Bosh sahifa', `Bugun: ${t.date}`) + `
    <div class="grid cols-4">
      ${stat("O'quvchilar", s.students, `${s.approvedStudents} ta tasdiqlangan`)}
      ${stat('Guruhlar', s.groups, `${s.teachers} o'qituvchi`)}
      ${stat('Bu oy tushum', money(s.month.income), `${s.month.paidCount} ta to'lov`)}
      ${stat('Qarzdorlar', s.month.debtors, s.month.debtors ? 'eslatma yuborish kerak' : 'hammasi joyida')}
    </div>

    <div class="grid cols-2" style="margin-top:16px">
      <div class="card">
        <h2>Bugungi davomat</h2>
        ${t.marked === 0
          ? '<p class="muted">Bugun hali davomat belgilanmagan.</p>'
          : `<div class="row" style="margin-top:10px">
              <span class="tag ok">✅ Keldi: ${t.present}</span>
              <span class="tag bad">❌ Kelmadi: ${t.absent}</span>
              <span class="tag warn">⏰ Kechikdi: ${t.late}</span>
              <span class="spacer"></span>
              <b>${t.attendanceRate}%</b>
            </div>`}
        <div class="row" style="margin-top:14px">
          <button data-go="attendance">Davomat belgilash →</button>
        </div>
      </div>

      <div class="card">
        <h2>Navbatdagi ishlar</h2>
        <div class="row" style="margin-top:10px">
          <span class="tag ${s.queue.grading ? 'warn' : 'mute'}">✍️ Baholanmagan test: ${s.queue.grading}</span>
          <span class="tag ${s.queue.pendingPurchases ? 'warn' : 'mute'}">🎬 Tasdiqlanmagan xarid: ${s.queue.pendingPurchases}</span>
        </div>
        <div class="row" style="margin-top:14px">
          <button data-go="grading">Baholash →</button>
          <button data-go="videos">Xaridlar →</button>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h2>Oxirgi 6 oy tushumi</h2>
      <div class="bars">
        ${income.data.map((i) => `<div class="bar" title="${money(i.income)}">
            <div class="fill" style="height:${Math.round((i.income / max) * 100)}%"></div>
            <div class="cap">${MONTHS[i.month - 1].slice(0, 3)}</div>
          </div>`).join('')}
      </div>
    </div>`;

  view().addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b) go(b.dataset.go);
  });
};

/* ---------------- O'quvchilar ---------------- */

let studentFilter = { search: '', groupId: '' };

routes.students = async () => {
  const q = new URLSearchParams({ role: 'student', limit: '200' });
  if (studentFilter.search) q.set('search', studentFilter.search);
  if (studentFilter.groupId) q.set('groupId', studentFilter.groupId);
  const res = await api('/users?' + q);

  view().innerHTML = page("O'quvchilar", `Jami: ${res.meta.total}`,
    `<button data-export>⬇️ CSV</button><button class="primary" data-add>+ O'quvchi qo'shish</button>`) + `
    <div class="card" style="margin-bottom:14px">
      <div class="row">
        <input id="fSearch" class="inline" placeholder="Ism yoki telefon…" value="${esc(studentFilter.search)}" style="min-width:220px" />
        <select id="fGroup" class="inline">
          <option value="">Barcha guruhlar</option>
          ${groupsCache.map((g) => `<option value="${g.id}" ${g.id === studentFilter.groupId ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="card table-wrap">
      <table><thead><tr>
        <th>Ism</th><th>Telefon</th><th>Guruh</th><th>Ball</th><th>Tasdiqlangan</th><th>Ota-ona kodi</th><th></th>
      </tr></thead><tbody>
      ${res.data.length === 0 ? '<tr><td colspan="7" class="empty">Topilmadi</td></tr>' : res.data.map((u) => `
        <tr>
          <td><b>${esc(u.name)}</b></td>
          <td>${esc(u.phone)}</td>
          <td>${esc(u.student?.groupName ?? '—')}</td>
          <td>${u.student?.currentPoints ?? 0}</td>
          <td>${u.student?.isApproved ? '<span class="tag ok">Ha</span>' : '<span class="tag mute">Yo\'q</span>'}</td>
          <td><code>${esc(u.student?.linkCode ?? '—')}</code></td>
          <td class="right">
            <button class="small" data-edit="${u.id}">Tahrir</button>
            ${me.role === 'super_admin' ? `<button class="small danger" data-del="${u.id}">O'chirish</button>` : ''}
          </td>
        </tr>`).join('')}
      </tbody></table>
    </div>`;

  $('#fSearch').addEventListener('change', (e) => { studentFilter.search = e.target.value.trim(); go('students'); });
  $('#fGroup').addEventListener('change', (e) => { studentFilter.groupId = e.target.value; go('students'); });
  $('[data-export]').addEventListener('click', () =>
    download('/stats/export/students' + (studentFilter.groupId ? `?groupId=${studentFilter.groupId}` : ''), 'oquvchilar.csv'));
  $('[data-add]').addEventListener('click', () => userModal('student'));

  view().addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (ed) editUserModal(res.data.find((u) => u.id === ed.dataset.edit));
    if (del) {
      const u = res.data.find((x) => x.id === del.dataset.del);
      confirmDialog(`${u.name} deaktivatsiya qilinsinmi? (ma'lumotlari saqlanadi)`, async () => {
        await api('/users/' + u.id, { method: 'DELETE' });
        toast('Deaktivatsiya qilindi', 'ok'); go('students');
      });
    }
  });
};

function groupOptions(selected = '') {
  return `<option value="">— guruhsiz —</option>` +
    groupsCache.map((g) => `<option value="${g.id}" ${g.id === selected ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
}

function userModal(role) {
  const isStudent = role === 'student';
  modal(isStudent ? "Yangi o'quvchi" : 'Yangi xodim', `
    <div class="field"><label>Ism familiya</label><input name="name" required minlength="2" /></div>
    <div class="field"><label>Telefon</label><input name="phone" placeholder="+998901234567" required /></div>
    <div class="field"><label>Parol</label><input name="password" type="text" value="${Math.random().toString(36).slice(-8)}" required minlength="6" /></div>
    ${isStudent
      ? `<div class="field"><label>Guruh</label><select name="groupId">${groupOptions()}</select></div>`
      : `<div class="field"><label>Rol</label><select name="role">
           <option value="teacher">O'qituvchi</option>
           ${me.role === 'super_admin' ? '<option value="admin">Admin</option>' : ''}
           <option value="parent">Ota-ona</option>
         </select></div>`}`,
    async (fd) => {
      const body = {
        name: fd.get('name'), phone: fd.get('phone'), password: fd.get('password'),
        role: isStudent ? 'student' : fd.get('role'),
      };
      if (isStudent && fd.get('groupId')) body.groupId = fd.get('groupId');
      await api('/users', { method: 'POST', body });
      toast('Qo\'shildi', 'ok');
      go(isStudent ? 'students' : 'staff');
    });
}

function editUserModal(u) {
  const isStudent = u.role === 'student';
  modal(u.name, `
    <div class="field"><label>Ism</label><input name="name" value="${esc(u.name)}" required /></div>
    <div class="field"><label>Telefon</label><input name="phone" value="${esc(u.phone)}" required /></div>
    <div class="field"><label>Yangi parol (bo'sh qoldirsangiz o'zgarmaydi)</label><input name="password" type="text" /></div>
    ${isStudent ? `
      <div class="field"><label>Guruh</label><select name="groupId">${groupOptions(u.student?.groupId ?? '')}</select></div>
      <div class="field"><label><input type="checkbox" name="isApproved" class="inline" ${u.student?.isApproved ? 'checked' : ''} style="width:auto;margin-right:6px" />
        Tasdiqlangan o'quvchi (barcha videolar bepul)</label></div>` : ''}
    <div class="field"><label><input type="checkbox" name="isActive" class="inline" ${u.isActive ? 'checked' : ''} style="width:auto;margin-right:6px" /> Faol</label></div>`,
    async (fd) => {
      const body = { name: fd.get('name'), phone: fd.get('phone'), isActive: fd.get('isActive') === 'on' };
      if (fd.get('password')) body.password = fd.get('password');
      if (isStudent) {
        body.isApproved = fd.get('isApproved') === 'on';
        body.groupId = fd.get('groupId') || null;
      }
      await api('/users/' + u.id, { method: 'PATCH', body });
      toast('Saqlandi', 'ok');
      go(current);
    });
}

/* ---------------- Xodimlar ---------------- */

routes.staff = async () => {
  const [teachers, admins, parents] = await Promise.all([
    api('/users?role=teacher&limit=100'),
    api('/users?role=admin&limit=100'),
    api('/users?role=parent&limit=100'),
  ]);
  const supers = me.role === 'super_admin' ? await api('/users?role=super_admin&limit=20') : { data: [] };
  const all = [...supers.data, ...admins.data, ...teachers.data, ...parents.data];

  view().innerHTML = page('Xodimlar va ota-onalar', `Jami: ${all.length}`, `<button class="primary" data-add>+ Xodim qo'shish</button>`) + `
    <div class="card table-wrap">
      <table><thead><tr><th>Ism</th><th>Rol</th><th>Telefon</th><th>Holat</th><th></th></tr></thead><tbody>
      ${all.map((u) => `<tr>
        <td><b>${esc(u.name)}</b></td>
        <td><span class="tag info">${ROLE_UZ[u.role]}</span></td>
        <td>${esc(u.phone)}</td>
        <td>${u.isActive ? '<span class="tag ok">Faol</span>' : '<span class="tag bad">Bloklangan</span>'}</td>
        <td class="right">${u.role === 'super_admin' ? '' : `<button class="small" data-edit="${u.id}">Tahrir</button>`}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;

  $('[data-add]').addEventListener('click', () => userModal('staff'));
  view().addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) editUserModal(all.find((u) => u.id === ed.dataset.edit));
  });
};

/* ---------------- Guruhlar ---------------- */

routes.groups = async () => {
  groupsCache = (await api('/groups')).data;
  const teachers = (await api('/users?role=teacher&limit=100')).data;

  view().innerHTML = page('Guruhlar', `Jami: ${groupsCache.length}`, `<button class="primary" data-add>+ Guruh yaratish</button>`) + `
    <div class="grid cols-2">
    ${groupsCache.length === 0 ? '<div class="card empty">Hali guruh yo\'q</div>' : groupsCache.map((g) => `
      <div class="card">
        <div class="row"><h2>${esc(g.name)}</h2><span class="spacer"></span>
          <button class="small" data-edit="${g.id}">Tahrir</button>
          <button class="small" data-open="${g.id}">O'quvchilar</button>
        </div>
        <p class="muted">O'qituvchi: ${esc(g.teacherName ?? 'biriktirilmagan')}</p>
        <div class="row">
          <span class="tag info">${g.studentsCount} o'quvchi</span>
          ${(g.schedule ?? []).map((s) => `<span class="tag mute">${s.day} ${s.startTime}–${s.endTime}</span>`).join('')}
        </div>
      </div>`).join('')}
    </div>`;

  const teacherOptions = (sel = '') =>
    `<option value="">— o'qituvchisiz —</option>` +
    teachers.map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('');

  $('[data-add]').addEventListener('click', () =>
    modal('Yangi guruh', `
      <div class="field"><label>Guruh nomi</label><input name="name" required minlength="2" /></div>
      <div class="field"><label>O'qituvchi</label><select name="teacherId">${teacherOptions()}</select></div>`,
      async (fd) => {
        const body = { name: fd.get('name') };
        if (fd.get('teacherId')) body.teacherId = fd.get('teacherId');
        await api('/groups', { method: 'POST', body });
        toast('Guruh yaratildi', 'ok'); go('groups');
      }));

  view().addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    const op = e.target.closest('[data-open]');
    if (ed) {
      const g = groupsCache.find((x) => x.id === ed.dataset.edit);
      modal(g.name, `
        <div class="field"><label>Nomi</label><input name="name" value="${esc(g.name)}" required /></div>
        <div class="field"><label>O'qituvchi</label><select name="teacherId">${teacherOptions(g.teacherId ?? '')}</select></div>`,
        async (fd) => {
          await api('/groups/' + g.id, { method: 'PATCH', body: { name: fd.get('name'), teacherId: fd.get('teacherId') || null } });
          toast('Saqlandi', 'ok'); go('groups');
        });
    }
    if (op) {
      studentFilter = { search: '', groupId: op.dataset.open };
      go('students');
    }
  });
};

/* ---------------- Davomat ---------------- */

const attState = { groupId: '', date: todayStr() };

routes.attendance = async () => {
  if (!attState.groupId && groupsCache[0]) attState.groupId = groupsCache[0].id;
  if (!attState.groupId) {
    view().innerHTML = page('Davomat', '') + '<div class="card empty">Avval guruh yarating.</div>';
    return;
  }

  const [group, existing] = await Promise.all([
    api('/groups/' + attState.groupId),
    api(`/attendance?groupId=${attState.groupId}&month=${attState.date.slice(0, 7)}`),
  ]);
  const byStudent = {};
  existing.data.filter((r) => r.date === attState.date).forEach((r) => (byStudent[r.studentId] = r.state));

  view().innerHTML = page('Davomat', `${group.data.name} — ${attState.date}`,
    `<button data-export>⬇️ CSV</button><button class="primary" data-save>Saqlash</button>`) + `
    <div class="card" style="margin-bottom:14px"><div class="row">
      <select id="aGroup" class="inline">${groupsCache.map((g) => `<option value="${g.id}" ${g.id === attState.groupId ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
      <input type="date" id="aDate" class="inline" value="${attState.date}" />
      <span class="spacer"></span>
      <button class="small" data-all="present">Hammasi keldi</button>
    </div></div>

    <div class="card table-wrap"><table><thead><tr><th>O'quvchi</th><th style="width:280px">Holat</th></tr></thead><tbody>
    ${group.data.students.length === 0 ? '<tr><td colspan="2" class="empty">Guruhda o\'quvchi yo\'q</td></tr>' :
      group.data.students.map((s) => `<tr data-student="${s.studentId}">
        <td><b>${esc(s.name)}</b></td>
        <td><div class="pill">
          <button type="button" data-state="present">✅ Keldi</button>
          <button type="button" data-state="absent">❌ Kelmadi</button>
          <button type="button" data-state="late">⏰ Kechikdi</button>
        </div></td></tr>`).join('')}
    </tbody></table></div>`;

  const paint = (tr, state) => {
    tr.querySelectorAll('[data-state]').forEach((b) => {
      b.className = b.dataset.state === state ? 'sel-' + state : '';
    });
    tr.dataset.value = state ?? '';
  };
  view().querySelectorAll('[data-student]').forEach((tr) => paint(tr, byStudent[tr.dataset.student]));

  $('#aGroup').addEventListener('change', (e) => { attState.groupId = e.target.value; go('attendance'); });
  $('#aDate').addEventListener('change', (e) => { attState.date = e.target.value; go('attendance'); });
  $('[data-all="present"]').addEventListener('click', () =>
    view().querySelectorAll('[data-student]').forEach((tr) => paint(tr, 'present')));
  $('[data-export]').addEventListener('click', () =>
    download(`/stats/export/attendance?groupId=${attState.groupId}&month=${attState.date.slice(0, 7)}`, 'davomat.csv'));

  view().addEventListener('click', (e) => {
    const b = e.target.closest('[data-state]');
    if (b) paint(b.closest('[data-student]'), b.dataset.state);
  });

  $('[data-save]').addEventListener('click', async () => {
    const records = [...view().querySelectorAll('[data-student]')]
      .filter((tr) => tr.dataset.value)
      .map((tr) => ({ studentId: tr.dataset.student, state: tr.dataset.value }));
    if (records.length === 0) return toast('Hech kim belgilanmadi', 'bad');
    try {
      const r = await api('/attendance/bulk', { method: 'PUT', body: { groupId: attState.groupId, date: attState.date, records } });
      toast(`${r.data.updated} ta yozuv saqlandi. Kelmaganlarning ota-onasiga xabar ketdi.`, 'ok');
    } catch (e) { toast(e.message, 'bad'); }
  });
};

/* ---------------- To'lovlar ---------------- */

const payState = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };

routes.payments = async () => {
  const [students, payments] = await Promise.all([
    api('/users?role=student&limit=300'),
    api(`/payments?month=${payState.month}&year=${payState.year}`),
  ]);
  const byId = {};
  payments.data.forEach((p) => (byId[p.studentId] = p));
  const withGroup = students.data.filter((s) => s.student?.groupId);

  view().innerHTML = page("To'lovlar", `${MONTHS[payState.month - 1]} ${payState.year} — barcha to'lovlar qo'lda belgilanadi`,
    `<button data-export>⬇️ CSV</button><button data-remind>📢 Qarzdorlarga eslatma</button><button class="primary" data-save>Saqlash</button>`) + `
    <div class="card" style="margin-bottom:14px"><div class="row">
      <select id="pMonth" class="inline">${MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === payState.month ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <input type="number" id="pYear" class="inline" style="width:100px" value="${payState.year}" min="2000" max="2100" />
      <span class="spacer"></span>
      <span class="muted">Standart summa: ${money(settings.monthlyFee)}</span>
    </div></div>

    <div class="card table-wrap"><table><thead><tr>
      <th>O'quvchi</th><th>Guruh</th><th style="width:300px">Holat</th><th style="width:150px">Summa</th><th>Izoh</th>
    </tr></thead><tbody>
    ${withGroup.length === 0 ? '<tr><td colspan="5" class="empty">Guruhga biriktirilgan o\'quvchi yo\'q</td></tr>' :
      withGroup.map((s) => {
        const p = byId[s.id];
        return `<tr data-student="${s.id}">
          <td><b>${esc(s.name)}</b><div class="muted">${esc(s.phone)}</div></td>
          <td>${esc(s.student.groupName ?? '')}</td>
          <td><div class="pill">
            <button type="button" data-state="paid">✅ To'landi</button>
            <button type="button" data-state="partial">🟡 Qisman</button>
            <button type="button" data-state="unpaid">❌ Yo'q</button>
          </div></td>
          <td><input type="number" data-amount value="${p?.amount ?? ''}" placeholder="${settings.monthlyFee || 0}" min="0" /></td>
          <td><input data-note value="${esc(p?.note ?? '')}" placeholder="naqd / karta…" /></td>
        </tr>`;
      }).join('')}
    </tbody></table></div>`;

  const paint = (tr, state) => {
    tr.querySelectorAll('[data-state]').forEach((b) => (b.className = b.dataset.state === state ? 'sel-' + state : ''));
    tr.dataset.value = state ?? '';
    if (state === 'paid' && !$('[data-amount]', tr).value && settings.monthlyFee) {
      $('[data-amount]', tr).value = settings.monthlyFee;
    }
  };
  view().querySelectorAll('[data-student]').forEach((tr) => paint(tr, byId[tr.dataset.student]?.state));

  $('#pMonth').addEventListener('change', (e) => { payState.month = +e.target.value; go('payments'); });
  $('#pYear').addEventListener('change', (e) => { payState.year = +e.target.value; go('payments'); });
  $('[data-export]').addEventListener('click', () =>
    download(`/stats/export/payments?year=${payState.year}&month=${payState.month}`, 'tolovlar.csv'));

  view().addEventListener('click', (e) => {
    const b = e.target.closest('[data-state]');
    if (b) paint(b.closest('[data-student]'), b.dataset.state);
  });

  $('[data-remind]').addEventListener('click', () =>
    confirmDialog(`${MONTHS[payState.month - 1]} oyi bo'yicha barcha qarzdorlarga (va ota-onalariga) eslatma yuborilsinmi?`, async () => {
      const r = await api('/payments/remind', { method: 'POST', body: { month: payState.month, year: payState.year } });
      toast(`${r.data.notified} ta o'quvchiga eslatma yuborildi`, 'ok');
    }));

  $('[data-save]').addEventListener('click', async () => {
    const records = [...view().querySelectorAll('[data-student]')]
      .filter((tr) => tr.dataset.value)
      .map((tr) => ({
        studentId: tr.dataset.student,
        month: payState.month,
        state: tr.dataset.value,
        amount: Number($('[data-amount]', tr).value || 0),
        note: $('[data-note]', tr).value || undefined,
      }));
    if (records.length === 0) return toast('Hech narsa belgilanmadi', 'bad');
    try {
      const r = await api('/payments/bulk', { method: 'PUT', body: { year: payState.year, records } });
      toast(`${r.data.updated} ta to'lov saqlandi`, 'ok');
    } catch (e) { toast(e.message, 'bad'); }
  });
};

/* ---------------- Ballar ---------------- */

routes.points = async () => {
  const [students, board] = await Promise.all([
    api('/users?role=student&limit=300'),
    api('/points/leaderboard?limit=10'),
  ]);

  view().innerHTML = page('Ballar', `Admin limitsiz ball bera oladi. O'qituvchi limiti: ±${settings.teacherPointLimit}`) + `
    <div class="grid cols-2">
      <div class="card table-wrap">
        <h2>Ball berish</h2>
        <table><thead><tr><th>O'quvchi</th><th>Ball</th><th></th></tr></thead><tbody>
        ${students.data.map((s) => `<tr>
          <td><b>${esc(s.name)}</b><div class="muted">${esc(s.student?.groupName ?? '—')}</div></td>
          <td><b>${s.student?.currentPoints ?? 0}</b></td>
          <td class="right">
            <button class="small" data-adj="${s.id}" data-sign="1">+ Ball</button>
            <button class="small" data-adj="${s.id}" data-sign="-1">− Ball</button>
            <button class="small" data-hist="${s.id}">Tarix</button>
          </td></tr>`).join('')}
        </tbody></table>
      </div>

      <div class="card">
        <h2>Reyting (TOP 10)</h2>
        <table><tbody>
        ${board.data.map((r) => `<tr>
          <td style="width:40px"><b>${r.rank}</b></td>
          <td>${esc(r.name)}</td>
          <td class="right"><b>${r.points}</b></td></tr>`).join('') || '<tr><td class="empty">Bo\'sh</td></tr>'}
        </tbody></table>
      </div>
    </div>`;

  view().addEventListener('click', async (e) => {
    const adj = e.target.closest('[data-adj]');
    const hist = e.target.closest('[data-hist]');
    if (adj) {
      const s = students.data.find((x) => x.id === adj.dataset.adj);
      const sign = Number(adj.dataset.sign);
      modal(`${s.name} — ball ${sign > 0 ? "qo'shish" : 'ayirish'}`, `
        <div class="field"><label>Miqdor</label><input type="number" name="change" min="1" value="5" required /></div>
        <div class="field"><label>Sabab (majburiy — o'quvchi va ota-onaga xabar ketadi)</label>
          <input name="reason" required minlength="3" placeholder="Masalan: darsda faol qatnashdi" /></div>`,
        async (fd) => {
          await api(`/points/${s.id}/adjust`, { method: 'POST', body: { change: sign * Number(fd.get('change')), reason: fd.get('reason') } });
          toast('Ball yangilandi, xabar yuborildi', 'ok'); go('points');
        });
    }
    if (hist) {
      const r = await api('/points/' + hist.dataset.hist);
      const rows = r.data.history.map((h) => `<tr>
        <td>${h.change > 0 ? '➕' : '➖'} ${Math.abs(h.change)}</td>
        <td>${esc(h.reason)}</td>
        <td class="muted">${esc(h.byUserName ?? '')}</td>
        <td class="muted">${new Date(h.date).toLocaleDateString('uz-UZ')}</td></tr>`).join('');
      modal('Ball tarixi', `<p>Joriy ball: <b>${r.data.current}</b></p>
        <div class="table-wrap"><table>${rows || '<tr><td>Yozuv yo\'q</td></tr>'}</table></div>`, async () => {});
    }
  });
};

/* ---------------- Oylik o'yin ---------------- */

const gameState = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };

routes.game = async () => {
  const r = await api(`/game/roster?year=${gameState.year}&month=${gameState.month}`);
  const d = r.data;

  view().innerHTML = page("Oylik o'yin", `Chegara: ${d.threshold} ball · ${MONTHS[gameState.month - 1]} ${gameState.year} — ${d.count} ta o'quvchi qatnashmoqda`,
    `<button data-export>⬇️ CSV</button>`) + `
    <div class="card" style="margin-bottom:14px"><div class="row">
      <select id="gMonth" class="inline">${MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === gameState.month ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <input type="number" id="gYear" class="inline" style="width:100px" value="${gameState.year}" min="2000" max="2100" />
      <span class="spacer"></span>
      <span class="tag ${d.current ? 'ok' : 'mute'}">${d.current ? 'Joriy oy — jonli' : 'Tugagan oy — arxiv'}</span>
    </div></div>

    <div class="card table-wrap">
      <h2>🎮 O'yinga qo'shilganlar</h2>
      <table><thead><tr><th style="width:44px">#</th><th>O'quvchi</th><th>Guruh</th><th class="right">Ball</th><th>Qo'shilgan sana</th></tr></thead><tbody>
      ${d.students.length === 0
        ? `<tr><td colspan="5" class="empty">Bu oyda hali hech kim chegaraga yetmagan</td></tr>`
        : d.students.map((s, i) => `<tr>
            <td><b>${i + 1}</b></td>
            <td><b>${esc(s.name)}</b><div class="muted">${esc(s.phone ?? '')}</div></td>
            <td>${esc(s.group ?? '—')}</td>
            <td class="right"><b>${s.points}</b></td>
            <td class="muted">${s.qualifiedAt ? new Date(s.qualifiedAt).toLocaleDateString('uz-UZ') : '—'}</td>
          </tr>`).join('')}
      </tbody></table>
    </div>`;

  $('#gMonth').addEventListener('change', (e) => { gameState.month = +e.target.value; go('game'); });
  $('#gYear').addEventListener('change', (e) => { gameState.year = +e.target.value; go('game'); });
  $('[data-export]').addEventListener('click', () =>
    download(`/game/roster/export?year=${gameState.year}&month=${gameState.month}`, `oyin-${gameState.year}-${gameState.month}.csv`));
};

/* ---------------- Baholash ---------------- */

routes.grading = async () => {
  const res = await api('/tests/attempts?status=grading&limit=50');

  view().innerHTML = page('Baholash navbati', `${res.meta.total} ta test o'qituvchi/admin bahosini kutmoqda`) + `
    <div class="card table-wrap"><table><thead><tr>
      <th>O'quvchi</th><th>Test</th><th>Avto ball</th><th>Anti-cheat</th><th>Topshirdi</th><th></th>
    </tr></thead><tbody>
    ${res.data.length === 0 ? '<tr><td colspan="6" class="empty">Navbat bo\'sh 🎉</td></tr>' : res.data.map((a) => `<tr>
      <td><b>${esc(a.studentName ?? '')}</b></td>
      <td>${esc(a.testTitle ?? '')}</td>
      <td>${a.autoScore ?? 0}</td>
      <td>${a.antiCheatCount ? `<span class="tag bad">${a.antiCheatCount} ⚠️</span>` : '<span class="tag ok">toza</span>'}</td>
      <td class="muted">${a.finishedAt ? new Date(a.finishedAt).toLocaleString('uz-UZ') : '—'}</td>
      <td class="right"><button class="small primary" data-grade="${a.id}">Baholash</button></td>
    </tr>`).join('')}
    </tbody></table></div>`;

  view().addEventListener('click', async (e) => {
    const b = e.target.closest('[data-grade]');
    if (!b) return;
    const at = (await api('/tests/attempts/' + b.dataset.grade)).data;
    const manual = at.questions.filter((q) => ['writing', 'speaking'].includes(q.section) && !q.isGraded);
    if (manual.length === 0) return toast('Baholanadigan savol qolmadi');

    const q = manual[0];
    modal(`${at.studentName} — ${q.section === 'writing' ? 'Writing' : 'Speaking'}`, `
      <p class="muted">Savol:</p><p>${esc(q.prompt)}</p>
      <p class="muted" style="margin-top:12px">O'quvchi javobi:</p>
      <div class="card" style="background:var(--bg);max-height:220px;overflow:auto">${esc(q.answer ?? '(javob yo\'q)')}</div>
      <div class="field" style="margin-top:14px"><label>Ball (0 – ${q.maxScore})</label>
        <input type="number" name="score" min="0" max="${q.maxScore}" step="0.5" required /></div>
      <div class="field"><label>Izoh (ixtiyoriy)</label><textarea name="comment" rows="2"></textarea></div>
      <p class="muted">Qolgan baholanmagan savollar: ${manual.length - 1} ta</p>`,
      async (fd) => {
        await api(`/tests/attempts/${at.id}/grade`, {
          method: 'POST',
          body: { questionId: q.questionId, score: Number(fd.get('score')), comment: fd.get('comment') || undefined },
        });
        toast('Baholandi', 'ok');
        go('grading');
      });
  });
};

/* ---------------- Videolar ---------------- */

routes.videos = async () => {
  const [videos, purchases] = await Promise.all([
    api('/videos'),
    api('/videos/purchases?status=pending_confirmation&limit=50'),
  ]);

  view().innerHTML = page('Video darslar', `${videos.data.length} ta video · ${purchases.meta.total} ta tasdiq kutmoqda`,
    `<button class="primary" data-upload>+ Video yuklash</button>`) + `
    ${purchases.data.length ? `<div class="card" style="margin-bottom:16px">
      <h2>Tasdiq kutayotgan xaridlar</h2>
      <p class="muted">Pul naqd/bank orqali olingach tasdiqlang — onlayn to'lov yo'q.</p>
      <div class="table-wrap"><table><thead><tr><th>O'quvchi</th><th>Video</th><th>Narx</th><th>Sana</th><th></th></tr></thead><tbody>
      ${purchases.data.map((p) => `<tr>
        <td><b>${esc(p.userName)}</b><div class="muted">${esc(p.userPhone)}</div></td>
        <td>${esc(p.videoTitle)}</td>
        <td>${money(p.price)}</td>
        <td class="muted">${new Date(p.createdAt).toLocaleDateString('uz-UZ')}</td>
        <td class="right"><button class="small primary" data-confirm="${p.videoId}" data-user="${p.userId}">Tasdiqlash</button></td>
      </tr>`).join('')}
      </tbody></table></div></div>` : ''}

    <div class="card table-wrap"><table><thead><tr>
      <th>Sarlavha</th><th>Narx</th><th>Tasdiqlanganlarga bepul</th><th></th>
    </tr></thead><tbody>
    ${videos.data.length === 0 ? '<tr><td colspan="4" class="empty">Hali video yo\'q</td></tr>' : videos.data.map((v) => `<tr>
      <td><b>${esc(v.title)}</b><div class="muted">${esc(v.description ?? '')}</div></td>
      <td>${v.price ? money(v.price) : '<span class="tag ok">Bepul</span>'}</td>
      <td>${v.isFreeForApproved ? '✅' : '—'}</td>
      <td class="right">
        <button class="small" data-edit="${v.id}">Tahrir</button>
        ${me.role === 'super_admin' ? `<button class="small danger" data-del="${v.id}">O'chirish</button>` : ''}
      </td></tr>`).join('')}
    </tbody></table></div>`;

  $('[data-upload]').addEventListener('click', () =>
    modal('Video yuklash', `
      <div class="field"><label>Sarlavha</label><input name="title" required minlength="2" /></div>
      <div class="field"><label>Tavsif</label><textarea name="description" rows="2"></textarea></div>
      <div class="field"><label>Narx (so'm, 0 = bepul)</label><input type="number" name="price" value="0" min="0" required /></div>
      <div class="field"><label><input type="checkbox" name="isFreeForApproved" checked style="width:auto;margin-right:6px" /> Tasdiqlangan o'quvchilarga bepul</label></div>
      <div class="field"><label>Video fayl</label><input type="file" name="file" accept="video/*" required /></div>
      <div class="field"><label>Muqova rasmi (ixtiyoriy)</label><input type="file" name="thumbnail" accept="image/*" /></div>
      <p class="muted">Katta fayl yuklanishi bir necha daqiqa olishi mumkin.</p>`,
      async (fd) => {
        if (!fd.get('thumbnail')?.size) fd.delete('thumbnail');
        fd.set('isFreeForApproved', fd.get('isFreeForApproved') === 'on' ? 'true' : 'false');
        await api('/videos', { method: 'POST', body: fd });
        toast('Video yuklandi', 'ok'); go('videos');
      }));

  view().addEventListener('click', (e) => {
    const cf = e.target.closest('[data-confirm]');
    const ed = e.target.closest('[data-edit]');
    const dl = e.target.closest('[data-del]');
    if (cf) confirmDialog('Xarid tasdiqlansinmi? (pul olinganiga ishonch hosil qiling)', async () => {
      await api(`/videos/${cf.dataset.confirm}/confirm-purchase`, { method: 'POST', body: { userId: cf.dataset.user } });
      toast('Tasdiqlandi', 'ok'); go('videos');
    });
    if (ed) {
      const v = videos.data.find((x) => x.id === ed.dataset.edit);
      modal(v.title, `
        <div class="field"><label>Sarlavha</label><input name="title" value="${esc(v.title)}" required /></div>
        <div class="field"><label>Narx</label><input type="number" name="price" value="${v.price}" min="0" required /></div>
        <div class="field"><label><input type="checkbox" name="isFreeForApproved" ${v.isFreeForApproved ? 'checked' : ''} style="width:auto;margin-right:6px" /> Tasdiqlanganlarga bepul</label></div>`,
        async (fd) => {
          await api('/videos/' + v.id, { method: 'PATCH', body: {
            title: fd.get('title'), price: Number(fd.get('price')), isFreeForApproved: fd.get('isFreeForApproved') === 'on',
          }});
          toast('Saqlandi', 'ok'); go('videos');
        });
    }
    if (dl) confirmDialog('Video butunlay o\'chirilsinmi?', async () => {
      await api('/videos/' + dl.dataset.del, { method: 'DELETE' });
      toast('O\'chirildi', 'ok'); go('videos');
    });
  });
};

/* ---------------- Maqolalar ---------------- */

routes.articles = async () => {
  const res = await api('/articles?limit=50');

  view().innerHTML = page('Maqolalar', 'Rasmiy saytdagi yangiliklar', `<button class="primary" data-add>+ Maqola</button>`) + `
    <div class="card table-wrap"><table><thead><tr><th>Sarlavha</th><th>Kategoriya</th><th>Sana</th><th></th></tr></thead><tbody>
    ${res.data.length === 0 ? '<tr><td colspan="4" class="empty">Hali maqola yo\'q</td></tr>' : res.data.map((a) => `<tr>
      <td><b>${esc(a.title)}</b></td>
      <td><span class="tag info">${esc(a.category)}</span></td>
      <td class="muted">${new Date(a.createdAt).toLocaleDateString('uz-UZ')}</td>
      <td class="right"><button class="small" data-edit="${a.id}">Tahrir</button><button class="small danger" data-del="${a.id}">O'chirish</button></td>
    </tr>`).join('')}
    </tbody></table></div>`;

  const form = (a = {}) => `
    <div class="field"><label>Sarlavha</label><input name="title" value="${esc(a.title ?? '')}" required minlength="3" /></div>
    <div class="field"><label>Kategoriya</label><input name="category" value="${esc(a.category ?? 'yangilik')}" required /></div>
    <div class="field"><label>Teglar (vergul bilan)</label><input name="tags" value="${esc((a.tags ?? []).join(', '))}" /></div>
    <div class="field"><label>Matn</label><textarea name="body" rows="7" required minlength="10">${esc(a.body ?? '')}</textarea></div>`;

  const payload = (fd) => ({
    title: fd.get('title'), category: fd.get('category'), body: fd.get('body'),
    tags: fd.get('tags').split(',').map((s) => s.trim()).filter(Boolean),
  });

  $('[data-add]').addEventListener('click', () =>
    modal('Yangi maqola', form(), async (fd) => {
      await api('/articles', { method: 'POST', body: payload(fd) });
      toast('Chop etildi', 'ok'); go('articles');
    }));

  view().addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    const dl = e.target.closest('[data-del]');
    if (ed) {
      const a = (await api('/articles/' + ed.dataset.edit)).data;
      modal('Maqolani tahrirlash', form(a), async (fd) => {
        await api('/articles/' + a.id, { method: 'PATCH', body: payload(fd) });
        toast('Saqlandi', 'ok'); go('articles');
      });
    }
    if (dl) confirmDialog('Maqola o\'chirilsinmi?', async () => {
      await api('/articles/' + dl.dataset.del, { method: 'DELETE' });
      toast('O\'chirildi', 'ok'); go('articles');
    });
  });
};

/* ---------------- Sayt o'qituvchilari ---------------- */

routes.teachers = async () => {
  const list = (await api('/teachers/all')).data;

  view().innerHTML = page("Sayt o'qituvchilari",
    `Rasmiy saytdagi "professional o'qituvchilar" bo'limi · ${list.length} ta`,
    `<button class="primary" data-add>+ O'qituvchi</button>`) + `
    <div class="card" style="margin-bottom:14px"><p class="muted" style="margin:0">
      Bu yerdagi o'zgarishlar rasmiy sayt bosh sahifasidagi kartalarga chiqadi.
      Tartib raqami kichigi oldinroq turadi. «Saytda» belgisi olib tashlansa — karta yashiriladi (ma'lumot o'chmaydi).
    </p></div>
    <div class="card table-wrap"><table><thead><tr>
      <th style="width:56px"></th><th>Ism</th><th>Yo'nalish</th><th>Yutug'i</th><th>Tartib</th><th>Holat</th><th></th>
    </tr></thead><tbody>
    ${list.length === 0 ? '<tr><td colspan="7" class="empty">Hali o\'qituvchi qo\'shilmagan</td></tr>' : list.map((t) => `<tr>
      <td>${avatarHtml(t)}</td>
      <td><b>${esc(t.name)}</b>${t.experienceYears ? `<div class="muted">${t.experienceYears} yil tajriba</div>` : ''}</td>
      <td>${esc(t.specialty)}</td>
      <td>${t.achievement ? `<span class="tag info">${esc(t.achievement)}</span>` : '<span class="muted">—</span>'}</td>
      <td>${t.sortOrder}</td>
      <td>${t.isActive ? '<span class="tag ok">Saytda</span>' : '<span class="tag mute">Yashirilgan</span>'}</td>
      <td class="right">
        <button class="small" data-edit="${t.id}">Tahrir</button>
        ${me.role === 'super_admin' ? `<button class="small danger" data-del="${t.id}">O'chirish</button>` : ''}
      </td>
    </tr>`).join('')}
    </tbody></table></div>`;

  const formHtml = (t = {}) => `
    <div class="field"><label>Ism familiya</label><input name="name" value="${esc(t.name ?? '')}" required minlength="2" /></div>
    <div class="field"><label>Yo'nalish / mutaxassislik</label><input name="specialty" value="${esc(t.specialty ?? '')}" placeholder="Masalan: Academic IELTS" required /></div>
    <div class="field"><label>Yutug'i / sertifikat (ixtiyoriy)</label><input name="achievement" value="${esc(t.achievement ?? '')}" placeholder="Masalan: IELTS 8.5" /></div>
    <div class="field"><label>Qisqacha ma'lumot (ixtiyoriy)</label><textarea name="bio" rows="2">${esc(t.bio ?? '')}</textarea></div>
    <div class="row">
      <div class="field" style="flex:1;min-width:120px"><label>Tajriba (yil)</label><input type="number" name="experienceYears" min="0" max="80" value="${t.experienceYears ?? ''}" /></div>
      <div class="field" style="flex:1;min-width:120px"><label>Tartib</label><input type="number" name="sortOrder" min="0" value="${t.sortOrder ?? 0}" /></div>
    </div>
    <div class="field"><label>Ijtimoiy havola (ixtiyoriy)</label><input name="socialUrl" value="${esc(t.socialUrl ?? '')}" placeholder="https://t.me/…" /></div>
    <div class="field"><label>Rasm ${t.id ? "(yangisini tanlasangiz almashtiriladi)" : '(ixtiyoriy)'}</label><input type="file" name="photo" accept="image/*" /></div>
    <div class="field"><label><input type="checkbox" name="isActive" ${t.id === undefined || t.isActive ? 'checked' : ''} class="inline" style="margin-right:6px" /> Saytda ko'rsatilsin</label></div>`;

  // multipart: checkboxni aniq 'true'/'false' qilamiz, bo'sh fayl/raqamlarni tozalaymiz
  const buildBody = (fd) => {
    fd.set('isActive', fd.get('isActive') === 'on' ? 'true' : 'false');
    if (!fd.get('photo')?.size) fd.delete('photo');
    if (!String(fd.get('experienceYears') ?? '').trim()) fd.delete('experienceYears');
    if (!String(fd.get('sortOrder') ?? '').trim()) fd.set('sortOrder', '0');
    return fd;
  };

  $('[data-add]').addEventListener('click', () =>
    modal("Yangi o'qituvchi", formHtml(), async (fd) => {
      await api('/teachers', { method: 'POST', body: buildBody(fd) });
      toast('Qo\'shildi', 'ok'); go('teachers');
    }));

  view().addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit]');
    const dl = e.target.closest('[data-del]');
    if (ed) {
      const t = list.find((x) => x.id === ed.dataset.edit);
      modal("O'qituvchini tahrirlash", formHtml(t), async (fd) => {
        await api('/teachers/' + t.id, { method: 'PATCH', body: buildBody(fd) });
        toast('Saqlandi', 'ok'); go('teachers');
      });
    }
    if (dl) confirmDialog("O'qituvchi butunlay o'chirilsinmi?", async () => {
      await api('/teachers/' + dl.dataset.del, { method: 'DELETE' });
      toast('O\'chirildi', 'ok'); go('teachers');
    });
  });
};

/* ---------------- Xabar yuborish ---------------- */

routes.broadcast = async () => {
  view().innerHTML = page('Xabar yuborish', 'Ilova ichidagi bildirishnoma + Telegram (bog\'langanlarga)') + `
    <div class="card" style="max-width:640px">
      <div class="field"><label>Kimga</label>
        <select id="bAud">
          <option value="all">Barchaga</option>
          <option value="role">Rol bo'yicha</option>
          <option value="group">Guruhga</option>
          <option value="debtors">Joriy oy qarzdorlariga</option>
        </select>
      </div>
      <div class="field" id="bRoleBox" style="display:none"><label>Rol</label>
        <select id="bRole"><option value="student">O'quvchilar</option><option value="parent">Ota-onalar</option><option value="teacher">O'qituvchilar</option></select>
      </div>
      <div class="field" id="bGroupBox" style="display:none"><label>Guruh</label>
        <select id="bGroup">${groupsCache.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select>
      </div>
      <div class="field" id="bParentsBox" style="display:none">
        <label><input type="checkbox" id="bParents" checked style="width:auto;margin-right:6px" /> Ota-onalarga ham yuborilsin</label>
      </div>
      <div class="field"><label>Xabar matni</label><textarea id="bText" rows="5" placeholder="Hurmatli o'quvchilar! Dushanba kuni dars bo'lmaydi…"></textarea></div>
      <p class="error" id="bErr"></p>
      <button class="primary" id="bSend">Yuborish</button>
    </div>`;

  const sync = () => {
    const a = $('#bAud').value;
    $('#bRoleBox').style.display = a === 'role' ? '' : 'none';
    $('#bGroupBox').style.display = a === 'group' ? '' : 'none';
    $('#bParentsBox').style.display = ['group', 'debtors'].includes(a) ? '' : 'none';
  };
  $('#bAud').addEventListener('change', sync);
  sync();

  $('#bSend').addEventListener('click', async () => {
    const text = $('#bText').value.trim();
    if (text.length < 3) return ($('#bErr').textContent = 'Xabar matni juda qisqa');
    const aud = $('#bAud').value;
    const body = { audience: aud, text };
    if (aud === 'role') body.role = $('#bRole').value;
    if (aud === 'group') body.groupId = $('#bGroup').value;
    if (['group', 'debtors'].includes(aud)) body.includeParents = $('#bParents').checked;

    confirmDialog('Xabar yuborilsinmi? Bekor qilib bo\'lmaydi.', async () => {
      const r = await api('/notifications/broadcast', { method: 'POST', body });
      toast(`${r.data.notified} ta foydalanuvchiga yuborildi`, 'ok');
      $('#bText').value = '';
    });
  });
};

/* ---------------- Sozlamalar ---------------- */

routes.settings = async () => {
  settings = (await api('/settings')).data;
  const ro = me.role !== 'super_admin';

  view().innerHTML = page('Sozlamalar', ro ? "O'zgartirish faqat super admin huquqida" : 'O\'zgarishlar darhol kuchga kiradi') + `
    <div class="card" style="max-width:520px">
      <div class="field"><label>O'qituvchi bir amalda bera oladigan maksimal ball (±)</label>
        <input type="number" id="sLimit" value="${settings.teacherPointLimit}" min="1" max="1000" ${ro ? 'disabled' : ''} /></div>
      <div class="field"><label>Yangi o'quvchiga beriladigan boshlang'ich ball</label>
        <input type="number" id="sInit" value="${settings.initialPoints}" min="0" ${ro ? 'disabled' : ''} /></div>
      <div class="field"><label>Standart oylik to'lov (so'm) — to'lov jadvalida avtomatik to'ldiriladi</label>
        <input type="number" id="sFee" value="${settings.monthlyFee}" min="0" ${ro ? 'disabled' : ''} /></div>
      <div class="field"><label>🎮 Oylik o'yinga qo'shilish uchun chegara ball</label>
        <input type="number" id="sGame" value="${settings.gameThreshold}" min="1" ${ro ? 'disabled' : ''} />
        <div class="muted">Shu ballga yetgan o'quvchi shu oygi o'yinga tushadi va xabar oladi. Har oy ball ${settings.initialPoints} ga qaytadi.</div></div>
      ${ro ? '' : '<button class="primary" id="sSave">Saqlash</button>'}
    </div>

    <div class="card" style="max-width:520px;margin-top:16px">
      <h2>Telegram bot</h2>
      <p class="muted">Xabarlar bog'langan foydalanuvchilarga avtomatik ketadi.</p>
      <div id="tgBox" class="row" style="margin-top:10px"></div>
    </div>`;

  if (!ro) $('#sSave').addEventListener('click', async () => {
    try {
      await api('/settings', { method: 'PATCH', body: {
        teacherPointLimit: Number($('#sLimit').value),
        initialPoints: Number($('#sInit').value),
        monthlyFee: Number($('#sFee').value),
        gameThreshold: Number($('#sGame').value),
      }});
      settings = (await api('/settings')).data;
      toast('Saqlandi', 'ok');
    } catch (e) { toast(e.message, 'bad'); }
  });

  const tg = (await api('/telegram/status')).data;
  const box = $('#tgBox');
  box.innerHTML = tg.linked
    ? `<span class="tag ok">✅ Sizning akkauntingiz bog'langan</span><button class="small" id="tgUnlink">Uzish</button>`
    : `<span class="tag mute">Bog'lanmagan</span><button class="small primary" id="tgLink">Telegramni ulash</button>`;

  if (tg.linked) $('#tgUnlink').addEventListener('click', async () => {
    await api('/telegram/link', { method: 'DELETE' }); toast('Uzildi', 'ok'); go('settings');
  });
  else $('#tgLink').addEventListener('click', async () => {
    try {
      const r = await api('/telegram/link-token', { method: 'POST' });
      window.open(r.data.url, '_blank');
      toast('Telegramda "Start" bosing, keyin sahifani yangilang', 'ok');
    } catch (e) { toast(e.message, 'bad'); }
  });
};

/* ---------------- Audit jurnali ---------------- */

routes.audit = async () => {
  const res = await api('/audit-logs?limit=100');
  view().innerHTML = page('Audit jurnali', `Oxirgi ${res.data.length} ta muhim amal (faqat super admin ko'radi)`) + `
    <div class="card table-wrap"><table><thead><tr><th>Sana</th><th>Amal</th><th>Obyekt</th><th>Tafsilot</th></tr></thead><tbody>
    ${res.data.map((a) => `<tr>
      <td class="muted">${new Date(a.createdAt).toLocaleString('uz-UZ')}</td>
      <td><span class="tag info">${esc(a.action)}</span></td>
      <td>${esc(a.entity)}</td>
      <td class="muted">${esc(JSON.stringify(a.newValue ?? {}).slice(0, 90))}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
};

/* ---------------- Ishga tushirish ---------------- */

window.addEventListener('hashchange', () => {
  const p = location.hash.slice(1);
  if (me && p && p !== current && routes[p]) go(p);
});

if (store.access) {
  boot().catch(() => logout());
}
