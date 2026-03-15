const API = '/api/v1';

function getToken() {
  return sessionStorage.getItem('whatsmont_token');
}
function setToken(t) {
  if (t) sessionStorage.setItem('whatsmont_token', t);
  else sessionStorage.removeItem('whatsmont_token');
}

function api(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(API + path, { ...options, headers }).then((r) => {
    const contentType = r.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const body = isJson ? r.json() : r.text();
    if (!r.ok) return body.then((data) => { throw { status: r.status, data }; });
    return body;
  });
}

// --- Views ---
function showView(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg || '';
  el.classList.toggle('hidden', !msg);
}

// --- Login ---
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoginError('');
  const key = document.getElementById('master-key').value.trim();
  if (!key) { showLoginError('Informe a chave.'); return; }
  try {
    const res = await api('/auth/login', { method: 'POST', body: JSON.stringify({ key }) });
    if (res.success && res.token) {
      setToken(res.token);
      showView('dashboard-view');
      document.getElementById('master-key').value = '';
      navigateTo('instances');
    } else showLoginError('Chave inválida.');
  } catch (err) {
    const msg = err.data?.error || 'Erro ao entrar.';
    showLoginError(msg);
  }
});

document.getElementById('logout')?.addEventListener('click', (e) => {
  e.preventDefault();
  setToken(null);
  showView('login-view');
});

// --- Dashboard navigation ---
function navigateTo(page) {
  document.querySelectorAll('.header nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.page === page);
  });
  if (page === 'instances') renderInstances();
  else if (page === 'tokens') renderTokens();
}

document.querySelectorAll('.header a[data-page]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(a.dataset.page);
  });
});

// --- Instances ---
async function renderInstances() {
  const main = document.getElementById('dashboard-main');
  main.innerHTML = '<p class="empty">Carregando...</p>';
  try {
    const res = await api('/instances');
    const list = res.data || [];
    main.innerHTML = `
      <section class="section">
        <div class="toolbar">
          <h2>Instâncias WhatsApp</h2>
          <button class="btn btn-primary" id="new-instance-btn">Nova instância</button>
        </div>
        <div class="card-list" id="instances-list"></div>
      </section>
    `;
    const container = document.getElementById('instances-list');
    if (list.length === 0) {
      container.innerHTML = '<p class="empty">Nenhuma instância. Crie uma para começar.</p>';
    } else {
      list.forEach((inst) => {
        const card = document.createElement('div');
        card.className = 'card';
        const statusClass = (inst.status || '').toLowerCase() === 'open' ? 'badge-open' : (inst.status || '').toLowerCase().includes('connect') ? 'badge-connecting' : 'badge-close';
        card.innerHTML = `
          <div class="card-info">
            <strong>${escapeHtml(inst.label)}</strong>
            <span>${escapeHtml(inst.evolution_instance_name)}</span>
          </div>
          <span class="badge ${statusClass}">${escapeHtml(inst.status || 'close')}</span>
          <div class="card-actions">
            <button class="btn btn-ghost btn-qr" data-id="${inst.id}">Ver QR</button>
            <button class="btn btn-danger btn-delete-instance" data-id="${inst.id}">Remover</button>
          </div>
        `;
        container.appendChild(card);
      });
      container.querySelectorAll('.btn-qr').forEach((b) => b.addEventListener('click', () => showQrModal(Number(b.dataset.id))));
      container.querySelectorAll('.btn-delete-instance').forEach((b) => b.addEventListener('click', () => deleteInstance(Number(b.dataset.id))));
    }
    document.getElementById('new-instance-btn').addEventListener('click', showNewInstanceModal);
  } catch (e) {
    if (e.status === 401) { setToken(null); showView('login-view'); return; }
    main.innerHTML = '<p class="empty error">Erro ao carregar instâncias.</p>';
  }
}

function showQrModal(instanceId) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = '<div class="modal"><h3>QR Code</h3><div class="qr-wrap">Carregando...</div><div class="modal-actions"><button class="btn btn-ghost close-modal">Fechar</button></div></div>';
  document.body.appendChild(overlay);
  const qrWrap = overlay.querySelector('.qr-wrap');
  const close = () => overlay.remove();
  overlay.querySelector('.close-modal').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  api('/instances/' + instanceId + '/qr')
    .then((res) => {
      const d = res.data;
      const base64 = d?.base64 ?? d?.code ?? (typeof d === 'string' ? d : null);
      if (base64) {
        qrWrap.innerHTML = '<img src="' + (base64.startsWith('data:') ? base64 : 'data:image/png;base64,' + base64) + '" alt="QR Code" />';
      } else {
        qrWrap.innerHTML = '<p class="empty">QR não disponível. Tente novamente.</p>';
      }
    })
    .catch(() => { qrWrap.innerHTML = '<p class="empty error">Erro ao obter QR.</p>'; });
}

function showNewInstanceModal() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Nova instância</h3>
      <form id="form-new-instance">
        <label>Nome da instância (único)</label>
        <input type="text" name="instanceName" required placeholder="ex: vendas" />
        <label>Rótulo (opcional)</label>
        <input type="text" name="label" placeholder="ex: Vendas WhatsApp" />
        <label>Integration</label>
        <select name="integration">
          <option value="WHATSAPP-BAILEYS">WHATSAPP-BAILEYS</option>
          <option value="WHATSAPP-BUSINESS">WHATSAPP-BUSINESS</option>
        </select>
        <label><input type="checkbox" name="qrcode" checked /> Gerar QR após criar</label>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost cancel-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary">Criar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.cancel-modal').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      instanceName: fd.get('instanceName').trim(),
      label: fd.get('label').trim() || undefined,
      integration: fd.get('integration'),
      qrcode: fd.get('qrcode') === 'on',
    };
    try {
      await api('/instances', { method: 'POST', body: JSON.stringify(payload) });
      close();
      renderInstances();
    } catch (err) {
      alert(err.data?.error || 'Erro ao criar instância.');
    }
  });
}

async function deleteInstance(id) {
  if (!confirm('Remover esta instância? Ela será excluída da Evolution também.')) return;
  try {
    await api('/instances/' + id, { method: 'DELETE' });
    renderInstances();
  } catch (e) {
    alert(e.data?.error || 'Erro ao remover.');
  }
}

// --- Tokens ---
async function renderTokens() {
  const main = document.getElementById('dashboard-main');
  main.innerHTML = '<p class="empty">Carregando...</p>';
  try {
    const res = await api('/tokens');
    const list = res.data || [];
    main.innerHTML = `
      <section class="section">
        <div class="toolbar">
          <h2>Tokens de conexão</h2>
          <button class="btn btn-primary" id="new-token-btn">Novo token</button>
        </div>
        <div class="card-list" id="tokens-list"></div>
      </section>
    `;
    const container = document.getElementById('tokens-list');
    if (list.length === 0) {
      container.innerHTML = '<p class="empty">Nenhum token. Crie um para sistemas externos.</p>';
    } else {
      list.forEach((t) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div class="card-info">
            <strong>${escapeHtml(t.label)}</strong>
            <span>${escapeHtml(t.token_mask)} · ${escapeHtml(t.instance_label || '—')}</span>
          </div>
          <span class="badge ${t.active ? 'badge-open' : 'badge-close'}">${t.active ? 'Ativo' : 'Revogado'}</span>
          <div class="card-actions">
            ${t.active ? '<button class="btn btn-ghost btn-revoke" data-id="' + t.id + '">Revogar</button>' : ''}
            <button class="btn btn-danger btn-delete-token" data-id="${t.id}">Excluir</button>
          </div>
        `;
        container.appendChild(card);
      });
      container.querySelectorAll('.btn-revoke').forEach((b) => b.addEventListener('click', () => revokeToken(Number(b.dataset.id))));
      container.querySelectorAll('.btn-delete-token').forEach((b) => b.addEventListener('click', () => deleteToken(Number(b.dataset.id))));
    }
    document.getElementById('new-token-btn').addEventListener('click', showNewTokenModal);
  } catch (e) {
    if (e.status === 401) { setToken(null); showView('login-view'); return; }
    main.innerHTML = '<p class="empty error">Erro ao carregar tokens.</p>';
  }
}

function showNewTokenModal() {
  let instances = [];
  api('/instances')
    .then((res) => { instances = res.data || []; })
    .catch(() => {})
    .then(() => {
      const options = instances.map((i) => `<option value="${i.id}">${escapeHtml(i.label)} (${escapeHtml(i.evolution_instance_name)})</option>`).join('');
      const overlay = document.createElement('div');
      overlay.className = 'overlay';
      overlay.innerHTML = `
        <div class="modal">
          <h3>Novo token</h3>
          <form id="form-new-token">
            <label>Rótulo</label>
            <input type="text" name="label" required placeholder="ex: Sistema CRM" />
            <label>Instância</label>
            <select name="instance_id" required>${options || '<option value="">Nenhuma instância</option>'}</select>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost cancel-modal">Cancelar</button>
              <button type="submit" class="btn btn-primary">Criar</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(overlay);
      const close = () => overlay.remove();
      overlay.querySelector('.cancel-modal').addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      overlay.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = { label: fd.get('label').trim(), instance_id: Number(fd.get('instance_id')) };
        try {
          const created = await api('/tokens', { method: 'POST', body: JSON.stringify(payload) });
          close();
          const data = created.data;
          if (data && data.token) {
            const reveal = document.createElement('div');
            reveal.className = 'overlay';
            reveal.innerHTML = `
              <div class="modal">
                <h3>Token criado</h3>
                <p class="token-warning">Copie e guarde. Este valor não será exibido novamente.</p>
                <div class="token-reveal">${escapeHtml(data.token)}</div>
                <div class="modal-actions"><button class="btn btn-primary copy-token" data-token="${escapeHtml(data.token)}">Copiar</button><button class="btn btn-ghost close-reveal">Fechar</button></div>
              </div>
            `;
            document.body.appendChild(reveal);
            reveal.querySelector('.copy-token').addEventListener('click', () => { navigator.clipboard.writeText(data.token); });
            reveal.querySelector('.close-reveal').addEventListener('click', () => { reveal.remove(); renderTokens(); });
          }
          renderTokens();
        } catch (err) {
          alert(err.data?.error || 'Erro ao criar token.');
        }
      });
    });
}

async function revokeToken(id) {
  try {
    await api('/tokens/' + id, { method: 'PATCH', body: JSON.stringify({ active: false }) });
    renderTokens();
  } catch (e) {
    alert(e.data?.error || 'Erro ao revogar.');
  }
}

async function deleteToken(id) {
  if (!confirm('Excluir este token? Sistemas que o usam deixarão de funcionar.')) return;
  try {
    await api('/tokens/' + id, { method: 'DELETE' });
    renderTokens();
  } catch (e) {
    alert(e.data?.error || 'Erro ao excluir.');
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// --- Connect page (external systems with ?token=xxx) ---
function initConnectPage() {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  if (!token) return false;
  document.getElementById('app').innerHTML = `
    <div class="view connect-container">
      <h1>Conectar WhatsApp</h1>
      <div class="qr-wrap">Carregando...</div>
      <div class="status" id="connect-status">—</div>
      <button class="btn btn-primary" id="refresh-qr">Atualizar QR</button>
    </div>
  `;
  const qrWrap = document.querySelector('.connect-container .qr-wrap');
  const statusEl = document.getElementById('connect-status');
  const update = () => {
    api('/connection/status', { headers: { 'Authorization': 'Bearer ' + token } })
      .then((r) => {
        const state = (r.data && r.data.state) || 'close';
        statusEl.textContent = state === 'open' ? 'Conectado' : state.includes('connect') ? 'Aguardando QR...' : 'Desconectado';
        statusEl.className = 'status ' + (state === 'open' ? 'connected' : 'disconnected');
      })
      .catch(() => { statusEl.textContent = 'Erro ao obter status'; });
  };
  const loadQr = () => {
    qrWrap.innerHTML = 'Carregando...';
    fetch(API + '/connection/qr', { headers: { 'Authorization': 'Bearer ' + token } })
      .then((r) => r.json())
      .then((res) => {
        const d = res.data;
        const base64 = d?.base64 ?? d?.code ?? (typeof d === 'string' ? d : null);
        if (base64) {
          qrWrap.innerHTML = '<img src="' + (base64.startsWith('data:') ? base64 : 'data:image/png;base64,' + base64) + '" alt="QR Code" />';
        } else {
          qrWrap.innerHTML = '<p class="empty">QR não disponível.</p>';
        }
      })
      .catch(() => { qrWrap.innerHTML = '<p class="empty error">Erro ao carregar QR.</p>'; });
    update();
  };
  loadQr();
  document.getElementById('refresh-qr').addEventListener('click', loadQr);
  setInterval(update, 10000);
  return true;
}

// --- Bootstrap ---
if (initConnectPage()) {
  // connect page rendered
} else if (getToken()) {
  showView('dashboard-view');
  navigateTo('instances');
} else {
  showView('login-view');
}
