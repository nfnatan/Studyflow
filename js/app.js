/* StudyFlow v2 — app.js
 * 1) Utilidades  2) Preferências e aparência  3) Criptografia e cofre  4) GitHub
 * 5) CRUD genérico  6) Início e finanças  7) Pomodoro  8) Som e alertas  9) Navegação e inicialização */
'use strict';

/* ---------- 1) Utilidades ---------- */
const $ = (s) => document.querySelector(s);
const e = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const z = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;       // Date -> "2026-11-09"
const diff = (d) => Math.round((new Date(d + 'T00:00') - new Date(iso(new Date()) + 'T00:00')) / 864e5); // dias até a data
const fmt = (d) => `${d.slice(8)}/${d.slice(5, 7)}`;
const brl = (v) => (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CATS = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Contas', 'Outros'];   // categorias das finanças
const CORES = ['#ff5d73', '#ffb24d', '#35d4a0', '#4da3ff', '#a97bff', '#ff7ad9', '#e6e04d', '#9aa5b8'];
const HORAS_ALERTA = [8, 22];   // alertas de vencimento só entre 8h e 22h (de hora em hora)
const AUTO_TRANCA_MIN = 10;     // tranca o app após X min em segundo plano (se o Pomodoro não estiver rodando)

/* ---------- 2) Preferências e aparência (não sensíveis; ficam só neste aparelho) ---------- */
let PREF = { tema: 'neon', veu: 45, som: 'sino', ...JSON.parse(localStorage.getItem('sf-pref') || '{}') };
const TEMAS = { neon: '#ff3b52', oceano: '#38a8ff', floresta: '#34d98c', violeta: '#a97bff', claro: '#f4f6fb' };
const aviso = (t) => ($('#cfgMsg').textContent = t);
function aparencia() {
  const bg = localStorage.getItem('sf-bg');                                   // foto de fundo (data URL)
  document.documentElement.dataset.t = PREF.tema;
  document.body.style.setProperty('--foto', bg ? `url("${bg}")` : 'none');
  document.body.style.setProperty('--veu', bg ? PREF.veu / 100 : 0);
  $('#veu').value = PREF.veu; $('#som').value = PREF.som;
  $('#temas').innerHTML = Object.entries(TEMAS).map(([k, c]) => `<button class="sw" data-tema="${k}" style="background:${c}" aria-pressed="${k === PREF.tema}" aria-label="Tema ${k}"></button>`).join('');
}
const salvarPref = () => { localStorage.setItem('sf-pref', JSON.stringify(PREF)); aparencia(); };
$('#fFoto').onchange = (ev) => {                       // reduz a foto (máx. 1400 px) para caber no armazenamento
  const f = ev.target.files[0]; if (!f) return;
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    try { localStorage.setItem('sf-bg', c.toDataURL('image/jpeg', 0.72)); aparencia(); aviso(''); } catch (x) { aviso('Foto grande demais para guardar.'); }
  };
  img.src = URL.createObjectURL(f);
};
$('#semFoto').onclick = () => { localStorage.removeItem('sf-bg'); aparencia(); };
$('#veu').oninput = (ev) => { PREF.veu = +ev.target.value; salvarPref(); };
$('#som').onchange = (ev) => { PREF.som = ev.target.value; salvarPref(); };
$('#fAud').onchange = (ev) => {                        // áudio próprio (máx. 1,5 MB) usado como alarme
  const f = ev.target.files[0]; if (!f) return;
  if (f.size > 1.5e6) return aviso('Áudio grande demais (máx. 1,5 MB).');
  const r = new FileReader();
  r.onload = () => { try { localStorage.setItem('sf-aud', r.result); PREF.som = 'meu'; salvarPref(); aviso('Áudio salvo.'); } catch (x) { aviso('Sem espaço para esse áudio.'); } };
  r.readAsDataURL(f);
};
$('#testar').onclick = () => som();
aparencia();

/* ---------- 3) Criptografia e cofre ----------
 * Senha mestra -> PBKDF2 (250 mil voltas) -> chave AES-256-GCM. A senha fica só na memória.
 * O cofre local (dados + token) e o arquivo no GitHub são texto cifrado: sem a senha, ninguém lê. */
const TE = new TextEncoder(), TD = new TextDecoder();
const b64 = (u) => { let s = ''; new Uint8Array(u).forEach((x) => (s += String.fromCharCode(x))); return btoa(s); };
const unb = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let SENHA = '', SALT, KEY, DB = { estudos: [], provas: [], contas: [], salario: 0 }, CFG = {};
const derivar = async (salt) => crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
  await crypto.subtle.importKey('raw', TE.encode(SENHA), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
async function cifrar(obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, KEY, TE.encode(JSON.stringify(obj)));
  return JSON.stringify({ v: 2, s: b64(SALT), iv: b64(iv), d: b64(ct) });
}
async function decifrar(txt) {
  const j = JSON.parse(txt), novo = j.s !== b64(SALT);   // outro aparelho pode ter outro "sal": deriva a chave dele
  const k = novo ? await derivar(unb(j.s)) : KEY;
  const r = JSON.parse(TD.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb(j.iv) }, k, unb(j.d))));
  if (novo) { SALT = unb(j.s); KEY = k; }
  return r;
}
const salvarCofre = async () => localStorage.setItem('sf-vault', await cifrar({ db: DB, cfg: CFG }));

$('#lockForm').onsubmit = async (ev) => {
  ev.preventDefault();
  const v = localStorage.getItem('sf-vault'); SENHA = $('#senha').value;
  try {
    if (v) { SALT = unb(JSON.parse(v).s); KEY = await derivar(SALT); const o = await decifrar(v); DB = { ...DB, ...o.db }; CFG = o.cfg || {}; }
    else {                                              // primeiro uso: cria o cofre
      if (SENHA.length < 8) throw 'curta';
      if (SENHA !== $('#senha2').value) throw 'dif';
      SALT = crypto.getRandomValues(new Uint8Array(16)); KEY = await derivar(SALT);
      try { DB = { ...DB, ...JSON.parse(localStorage.getItem('sf-db') || '{}') }; CFG = JSON.parse(localStorage.getItem('sf-cfg') || '{}'); } catch (x) {}
      localStorage.removeItem('sf-db'); localStorage.removeItem('sf-cfg');  // apaga dados abertos da versão 1
      await salvarCofre();
    }
    $('#lock').hidden = true; iniciar();
  } catch (x) { SENHA = ''; $('#lockMsg').textContent = x === 'curta' ? 'Use pelo menos 8 caracteres.' : x === 'dif' ? 'As senhas não conferem.' : 'Senha incorreta.'; }
};
if (!localStorage.getItem('sf-vault')) { $('#l2').hidden = false; $('#lockTxt').textContent = 'Crie uma senha mestra. Guarde-a bem: sem ela os dados não podem ser recuperados.'; }

/* ---------- 4) GitHub como banco (sempre com dados cifrados) ---------- */
let sha = null, timer;                                  // sha = versão do arquivo no GitHub (exigida para atualizar)
const setSync = (t) => ($('#sync').textContent = t);
const api = () => `https://api.github.com/repos/${CFG.repo}/contents/${CFG.path || 'data.json'}`;
const hdr = () => ({ Authorization: 'Bearer ' + CFG.token, Accept: 'application/vnd.github+json' });
const pronto = () => CFG.repo && CFG.token;
async function ghGet() {
  if (!pronto()) return;
  try {
    const r = await fetch(api(), { headers: hdr() });
    if (r.status === 404) { sha = null; return ghPut(); }  // ainda não existe: cria
    if (!r.ok) throw 0;
    const j = await r.json(); sha = j.sha;
    const txt = atob(j.content.replace(/\n/g, '')), p = JSON.parse(txt);
    DB = { ...DB, ...(p.d ? await decifrar(txt) : p) };  // sem "d" = arquivo antigo aberto: importa e recifra
    await salvarCofre(); setSync('🔒 sincronizado');
    if (!p.d) await ghPut();
  } catch (x) { setSync('⚠️ offline ou senha diferente'); }
}
async function ghPut() {
  if (!pronto()) return;
  try {
    const body = { message: 'StudyFlow: atualiza dados', content: btoa(await cifrar(DB)), sha: sha || undefined };
    const r = await fetch(api(), { method: 'PUT', headers: hdr(), body: JSON.stringify(body) });
    if (!r.ok) throw 0;
    sha = (await r.json()).content.sha; setSync('🔒 sincronizado');
  } catch (x) { setSync('⚠️ erro de sync'); }
}
function salvar() {                                     // chamado após qualquer mudança
  salvarCofre();
  clearTimeout(timer); timer = setTimeout(ghPut, 1500); // junta várias edições num commit só
  renderAll();
}

/* ---------- 5) CRUD genérico ----------
 * Cada coleção descreve seus campos [chave, rótulo, tipo, opções]; lista e formulário saem daqui. */
const OPT = ['assunto', 'conteudo'];            // campos opcionais
const SCHEMA = {
  estudos: {
    campos: [['dia', 'Dia', 'select', DIAS.map((d, i) => [i, d])], ['ini', 'Início', 'time'], ['fim', 'Fim', 'time'], ['mat', 'Matéria', 'text'], ['assunto', 'Assunto (opcional)', 'text']],
    ordem: (a, b) => a.dia - b.dia || a.ini.localeCompare(b.ini),
    valida: (o) => (o.fim <= o.ini ? ['fim', 'O fim precisa ser depois do início'] : null),
    linha: (x) => `${DIAS[x.dia]} ${x.ini}–${x.fim} · <b>${e(x.mat)}</b> ${e(x.assunto || '')}`,
  },
  provas: {
    campos: [['mat', 'Matéria', 'text'], ['data', 'Data', 'date'], ['conteudo', 'Conteúdo (opcional)', 'text']],
    ordem: (a, b) => a.data.localeCompare(b.data),
    cls: (x) => (diff(x.data) >= 0 && diff(x.data) < 7 ? 'alerta' : ''),     // destaque: menos de 7 dias
    linha: (x) => `${fmt(x.data)} · <b>${e(x.mat)}</b> ${e(x.conteudo || '')} · ${diff(x.data) >= 0 ? 'em ' + diff(x.data) + ' d' : 'passou'}`,
  },
  contas: {                                             // lançamentos financeiros (a lista é desenhada por financas())
    campos: [['desc', 'Descrição', 'text'], ['valor', 'Valor (R$)', 'number'], ['tipo', 'Tipo', 'select', [['despesa', 'Despesa'], ['boleto', 'Boleto'], ['receita', 'Receita']]], ['cat', 'Categoria', 'select', CATS.map((c) => [c, c])], ['venc', 'Data / vencimento', 'date'], ['rec', 'Repete todo mês', 'check']],
  },
};
function crud(nome) {                                   // READ: desenha a lista (toque no item para editar)
  const S = SCHEMA[nome];
  const itens = [...DB[nome]].sort(S.ordem).map((x) =>
    `<li class="${S.cls ? S.cls(x) : ''}"><span data-edit="${nome}:${x.id}">${S.linha(x)}</span>${S.extra ? S.extra(x) : ''}<button data-del="${nome}:${x.id}" aria-label="Excluir">✕</button></li>`).join('');
  $(`[data-crud=${nome}]`).innerHTML = `<button class="add" data-novo="${nome}">+ novo</button><ul>${itens || '<li class="vazio">Nada por aqui. Toque em “+ novo”.</li>'}</ul>`;
}
function abrir(nome, id) {                              // CREATE (sem id) ou UPDATE (com id)
  const x = DB[nome].find((i) => i.id === id) || (nome === 'contas' ? { tipo: 'despesa', cat: 'Outros', venc: iso(new Date()) } : {});
  $('#frm').dataset.nome = nome; $('#frm').dataset.id = id || '';
  $('#frm').innerHTML = SCHEMA[nome].campos.map(([k, l, t, o]) => `<label>${l}` + (
    t === 'select' ? `<select name="${k}">${o.map(([v, n]) => `<option value="${v}"${String(x[k]) === String(v) ? ' selected' : ''}>${n}</option>`).join('')}</select>`
    : t === 'check' ? `<input type="checkbox" name="${k}"${x[k] ? ' checked' : ''}>`
    : `<input name="${k}" type="${t}" value="${e(x[k] ?? '')}"${OPT.includes(k) ? '' : ' required'}${t === 'number' ? ' step="0.01" min="0"' : ''}>`) + '</label>').join('') +
    '<div class="row"><button>Salvar</button><button type="button" class="ghost" id="cancela">Cancelar</button></div>';
  $('#dlg').showModal();
}
$('#frm').onsubmit = (ev) => {
  ev.preventDefault();
  const f = ev.target, { nome, id } = f.dataset, S = SCHEMA[nome], o = {};
  S.campos.forEach(([k, , t]) => {
    const v = f.elements[k];
    o[k] = t === 'check' ? v.checked : t === 'number' || (t === 'select' && v.value !== '' && !isNaN(v.value)) ? +v.value : v.value.trim();
  });
  const erro = S.valida && S.valida(o);
  if (erro) { f.elements[erro[0]].setCustomValidity(erro[1]); f.reportValidity(); f.elements[erro[0]].setCustomValidity(''); return; }
  if (id) Object.assign(DB[nome].find((i) => i.id === id), o);
  else DB[nome].push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), criado: iso(new Date()), ...o });
  $('#dlg').close(); salvar();
};
document.addEventListener('click', (ev) => {            // todos os botões numa só função (delegação de eventos)
  const b = ev.target.closest('[data-go],[data-novo],[data-edit],[data-del],[data-pago],[data-tema],[data-mes],[data-filtro],#cancela'); if (!b) return;
  const d = b.dataset;
  if (d.go) go(d.go);
  else if (d.novo) abrir(d.novo);
  else if (d.edit) abrir(...d.edit.split(':'));
  else if (d.del) { const [n, id] = d.del.split(':'); if (confirm('Excluir este item?')) { DB[n] = DB[n].filter((i) => i.id !== id); salvar(); } }
  else if (d.pago) {                                    // lançamento fixo é pago mês a mês; os demais, uma vez só
    const c = DB.contas.find((i) => i.id === d.pago);
    if (c.rec) { c.pagos = c.pagos || []; const k = c.pagos.indexOf(MES); k < 0 ? c.pagos.push(MES) : c.pagos.splice(k, 1); } else c.pago = !c.pago;
    salvar();
  }
  else if (d.mes) { MES = somaMes(MES, +d.mes); renderAll(); }
  else if (d.filtro) { FILTRO = d.filtro; renderAll(); }
  else if (d.tema) { PREF.tema = d.tema; salvarPref(); }
  else $('#dlg').close();
});

/* ---------- 6) Início e finanças ---------- */
function inicio() {                                     // cartões interativos: tocar leva para a aba certa
  const ag = new Date(), hm = ag.toTimeString().slice(0, 5), h = ag.getHours();
  $('#oi').textContent = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const prox = DB.estudos.filter((b) => b.dia === ag.getDay() && b.fim > hm).sort(SCHEMA.estudos.ordem)[0];
  const mA = iso(ag).slice(0, 7);
  const o = [-1, 0, 1].flatMap((n) => ocorr(somaMes(mA, n))).filter((p) => !p.pago && p.x.tipo !== 'receita').sort((a, b) => a.data.localeCompare(b.data))[0];
  const conta = o && { desc: o.x.desc, valor: o.x.valor, venc: o.data };
  const prova = DB.provas.filter((p) => diff(p.data) >= 0).sort(SCHEMA.provas.ordem)[0];
  const sobra = tot(ocorr(mA)).S;
  const t = (go, a, b, c, cls = '') => `<button class="tile ${cls}" data-go="${go}"><small>${a}</small><b>${b}</b><span>${c}</span></button>`;
  $('#tiles').innerHTML =
    t('estudos', 'Próximo estudo', prox ? `${prox.ini} ${e(prox.mat)}` : 'Livre hoje', prox ? 'toque para ver a tabela' : 'nenhum bloco restante') +
    t('financas', 'Próximo vencimento', conta ? e(conta.desc) : 'Tudo em dia', conta ? `${brl(conta.valor)} · ${diff(conta.venc) < 0 ? 'atrasada' : diff(conta.venc) === 0 ? 'hoje' : 'em ' + diff(conta.venc) + ' d'}` : 'sem contas pendentes', conta && diff(conta.venc) <= 1 ? 'alerta' : '') +
    t('estudos', 'Próxima prova', prova ? e(prova.mat) : 'Nenhuma', prova ? `em ${diff(prova.data)} d` : 'sem data marcada') +
    t('financas', 'Saldo do mês', brl(sobra), sobra >= 0 ? 'o salário dá' : 'não dá') +
    t('pomodoro', 'Pomodoro', `${ciclos()} ciclos`, 'hoje · toque para focar');
}
/* ---- Finanças: lançamentos por mês (receitas, despesas, boletos), categorias, fixos e gráfico ---- */
let MES = iso(new Date()).slice(0, 7), FILTRO = 'todos';              // mês exibido e filtro da lista
const somaMes = (m, n) => { const d = new Date(m + '-01T00:00'); d.setMonth(d.getMonth() + n); return iso(d).slice(0, 7); };
const ref = (x) => x.venc || x.criado || iso(new Date());              // data-base do lançamento
function ocorr(m) {                                                    // lançamentos de um mês; os "fixos" repetem todo mês
  const dm = new Date(+m.slice(0, 4), +m.slice(5), 0).getDate();       // dias do mês (evita dia 31 em mês de 30)
  return DB.contas.filter((x) => (x.rec ? ref(x).slice(0, 7) <= m : ref(x).slice(0, 7) === m)).map((x) => ({
    x, rec: x.rec, data: x.rec ? m + '-' + z(Math.min(+ref(x).slice(8), dm)) : ref(x), pago: x.rec ? (x.pagos || []).includes(m) : !!x.pago }));
}
const tot = (L) => {                                                   // receitas (salário + extras), despesas, pago e saldo
  const des = L.filter((o) => o.x.tipo !== 'receita'), soma = (a) => a.reduce((s, o) => s + o.x.valor, 0);
  const R = DB.salario + soma(L.filter((o) => o.x.tipo === 'receita')), D = soma(des);
  return { des, R, D, P: soma(des.filter((o) => o.pago)), S: R - D };
};
function financas() {
  const L = ocorr(MES), { des, R, D, P, S } = tot(L), pct = R ? Math.min(100, Math.round((D / R) * 100)) : D ? 100 : 0;
  const cats = CATS.map((c, i) => [c, des.filter((o) => (o.x.cat || 'Outros') === c).reduce((s, o) => s + o.x.valor, 0), CORES[i]]).filter((a) => a[1] > 0);
  let ac = 0; const cone = cats.map(([, v, c]) => { const a = (ac / D) * 100; ac += v; return `${c} ${a}% ${(ac / D) * 100}%`; }).join(',');
  const kpi = (t, v, c = '') => `<div class="kpi"><small>${t}</small><b class="${c}">${v}</b></div>`;
  $('#mesTxt').textContent = new Date(MES + '-01T00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  $('#resumo').innerHTML = `<div class="kpis">${kpi('Receitas', brl(R))}${kpi('Despesas', brl(D))}${kpi('Saldo', brl(S), S >= 0 ? 'ok' : 'ruim')}${kpi('A pagar', brl(D - P))}</div>` +
    `<div class="card"><label>Salário base (R$)<input id="sal" type="number" step="0.01" min="0" value="${DB.salario || ''}"></label>` +
    `<div class="bar"><i style="width:${pct}%"></i></div><p>${pct}% da receita comprometida · ${S >= 0 ? '✔ o salário dá, sobram ' + brl(S) : '✖ não dá, faltam ' + brl(-S)}</p>` +
    (cats.length ? `<div class="cats"><div class="donut" style="background:conic-gradient(${cone})"></div><div>${cats.map(([c, v, cor]) => `<div class="lg"><i style="background:${cor}"></i><span>${c}</span><b>${brl(v)}</b></div>`).join('')}</div></div>` : '') + '</div>';
  $('#sal').onchange = (ev) => { DB.salario = +ev.target.value || 0; salvar(); };
  $('#chips').innerHTML = [['todos', 'Todos'], ['pend', 'Pendentes'], ['pago', 'Pagos'], ['rec', 'Receitas']].map(([k, l]) => `<button class="chip" data-filtro="${k}" aria-pressed="${FILTRO === k}">${l}</button>`).join('');
  const ver = L.filter((o) => (FILTRO === 'pend' ? !o.pago && o.x.tipo !== 'receita' : FILTRO === 'pago' ? o.pago : FILTRO === 'rec' ? o.x.tipo === 'receita' : true)).sort((a, b) => a.data.localeCompare(b.data));
  $('#lista').innerHTML = '<ul>' + (ver.map((o) => {
    const d = diff(o.data), r = o.x.tipo === 'receita', st = o.pago ? (r ? 'recebido' : 'pago') : d < 0 ? 'atrasada' : d === 0 ? 'hoje' : 'em ' + d + ' d';
    return `<li class="${o.pago ? 'pago' : !r && d <= 1 ? 'alerta' : ''}"><span data-edit="contas:${o.x.id}"><b>${e(o.x.desc)}</b> ${o.rec ? '🔁' : ''}<br><small>${fmt(o.data)} · ${e(o.x.cat || 'Outros')} · ${st}</small></span>` +
      `<b class="${r ? 'ok' : ''}">${r ? '+' : '−'}${brl(o.x.valor)}</b><button data-pago="${o.x.id}" aria-label="Alternar pago">${o.pago ? '↺' : '✓'}</button><button data-del="contas:${o.x.id}" aria-label="Excluir">✕</button></li>`;
  }).join('') || '<li class="vazio">Nenhum lançamento aqui. Toque em “+ lançamento”.</li>') + '</ul>';
}
$('#csv').onclick = () => {                                            // exporta o mês para planilha (abre no Excel/Sheets)
  const l = ocorr(MES).map((o) => [o.data, o.x.tipo, o.x.cat || 'Outros', '"' + o.x.desc.replace(/"/g, '""') + '"', o.x.valor, o.pago ? 'sim' : 'não'].join(';'));
  const a = document.createElement('a'); a.download = `financas-${MES}.csv`;
  a.href = URL.createObjectURL(new Blob(['\ufeffdata;tipo;categoria;descricao;valor;pago\n' + l.join('\n')], { type: 'text/csv' })); a.click();
};
function renderAll() { ['estudos', 'provas'].forEach(crud); financas(); inicio(); }

/* ---------- 7) Pomodoro ----------
 * Guarda o horário de término (P.fim) em vez de contar segundos: o tempo não atrasa com a tela bloqueada. */
const P = { modo: 'foco', fim: null, resta: 1500 };
const ciclos = () => +(localStorage.getItem('sf-ciclos-' + iso(new Date())) || 0);
const mins = () => +$(P.modo === 'foco' ? '#pFoco' : '#pPausa').value || 25;
function pRender() {
  const tot = mins() * 60, s = P.fim ? Math.max(0, Math.ceil((P.fim - Date.now()) / 1000)) : P.resta;
  const t = `${z(Math.floor(s / 60))}:${z(s % 60)}`;
  $('#tempo').textContent = t; $('#modo').textContent = P.modo === 'foco' ? 'FOCO' : 'PAUSA';
  $('#arc').style.strokeDashoffset = 339.3 * (1 - Math.min(1, s / tot));   // o anel "esvazia" conforme o tempo passa
  $('#pStart').textContent = P.fim ? 'Pausar' : 'Iniciar'; $('#ciclos').textContent = 'Ciclos hoje: ' + ciclos();
  document.title = P.fim ? `${t} · StudyFlow` : 'StudyFlow';
  if (P.fim && s === 0) pFim();
}
function pFim() {                                       // terminou: conta o ciclo, toca o som e troca foco/pausa
  const foco = P.modo === 'foco';
  if (foco) localStorage.setItem('sf-ciclos-' + iso(new Date()), ciclos() + 1);
  alerta(foco ? 'Hora da pausa' : 'Volta ao foco', foco ? 'Ciclo concluído. Respire um pouco.' : 'Bora estudar.');
  P.modo = foco ? 'pausa' : 'foco'; P.fim = null; P.resta = mins() * 60;
}
$('#pStart').onclick = () => { ctx().resume(); if (P.fim) { P.resta = Math.ceil((P.fim - Date.now()) / 1000); P.fim = null; } else P.fim = Date.now() + P.resta * 1000; pRender(); };
$('#ring').onclick = () => $('#pStart').click();
$('#pReset').onclick = () => { P.modo = 'foco'; P.fim = null; P.resta = mins() * 60; pRender(); };
$('#pFoco').onchange = $('#pPausa').onchange = () => { if (!P.fim) { P.resta = mins() * 60; pRender(); } };
setInterval(pRender, 500);

/* ---------- 8) Som e alertas ----------
 * Sons sintetizados (sem arquivos) ou o seu áudio. Navegadores só liberam som após um toque na tela. */
let AC;
const ctx = () => AC || (AC = new (window.AudioContext || window.webkitAudioContext)());
document.addEventListener('pointerdown', () => ctx().resume(), { once: true });
const SONS = { sino: [[880, 0], [1318, 0.18], [1760, 0.36]], digital: [[1000, 0], [1000, 0.2], [1000, 0.4]], suave: [[523, 0], [659, 0.25], [784, 0.5]] };
function som() {
  const aud = localStorage.getItem('sf-aud');
  if (PREF.som === 'meu' && aud) return new Audio(aud).play().catch(() => {});
  const c = ctx(); c.resume();
  (SONS[PREF.som] || SONS.sino).forEach(([f, t]) => {
    const o = c.createOscillator(), g = c.createGain(), s = c.currentTime + t;
    o.type = PREF.som === 'digital' ? 'square' : 'sine'; o.frequency.value = f; o.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.3, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.35);
    o.start(s); o.stop(s + 0.4);
  });
}
function toast(txt) { const el = $('#toast'); el.textContent = txt; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 6000); }
async function notifica(titulo, corpo) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker?.getRegistration();
  reg ? reg.showNotification(titulo, { body: corpo, icon: 'icons/icon-192.png', vibrate: [200, 100, 200] }) : new Notification(titulo, { body: corpo });
}
function alerta(t, c) { som(); toast(`${t} — ${c}`); notifica(t, c); navigator.vibrate?.([200, 100, 200]); }
function verifica() {                                   // roda a cada 30 s e ao voltar para o app
  const ag = new Date(), hm = ag.toTimeString().slice(0, 5), dia = ag.getDay(), h = iso(ag), hr = ag.getHours();
  const av = Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem('sf-av') || '{}')).filter(([k]) => k.startsWith(h)));
  const uma = (k, t, c) => { if (!av[h + k]) { av[h + k] = 1; alerta(t, c); } };   // cada chave só avisa uma vez
  DB.estudos.filter((b) => b.dia === dia && b.ini === hm).forEach((b) => uma(b.id, 'Hora de estudar', `${b.mat} · ${b.ini}–${b.fim}`));
  DB.provas.filter((p) => diff(p.data) >= 0 && diff(p.data) <= 2).forEach((p) => uma(p.id, 'Prova chegando', `${p.mat} · ${diff(p.data) ? 'em ' + diff(p.data) + ' d' : 'hoje'}`));
  if (hr >= HORAS_ALERTA[0] && hr < HORAS_ALERTA[1])    // a chave inclui a hora: o aviso de vencimento se repete de hora em hora
    [-1, 0, 1].flatMap((n) => ocorr(somaMes(h.slice(0, 7), n))).filter((o) => !o.pago && o.x.tipo !== 'receita' && diff(o.data) <= 1)
      .forEach((o) => uma(o.x.id + '-' + hr, 'Conta vencendo', `${o.x.desc} · ${brl(o.x.valor)} · ${diff(o.data) < 0 ? 'atrasada' : diff(o.data) ? 'amanhã' : 'hoje'}`));
  localStorage.setItem('sf-av', JSON.stringify(av));
}
$('#nBtn').onclick = async () => { if ('Notification' in window) aviso('Notificações: ' + (await Notification.requestPermission())); };
setInterval(verifica, 30000);

/* ---------- 9) Navegação e inicialização ---------- */
function go(id) {
  document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== id));
  document.querySelectorAll('nav button').forEach((b) => b.setAttribute('aria-current', b.dataset.go === id));
  scrollTo(0, 0);
}
$('#gSave').onclick = async () => {
  CFG = { repo: $('#gRepo').value.trim(), token: $('#gTok').value.trim() || CFG.token, path: $('#gPath').value.trim() || 'data.json' };
  $('#gTok').value = ''; await salvarCofre(); ghGet().then(renderAll);
};
$('#trancar').onclick = () => location.reload();       // recarregar apaga a senha da memória e volta ao bloqueio
let oculto = 0;                                         // tranca sozinho depois de um tempo em segundo plano
document.addEventListener('visibilitychange', () => {
  if (document.hidden) oculto = Date.now();
  else if (SENHA && !P.fim && Date.now() - oculto > AUTO_TRANCA_MIN * 6e4) location.reload();
  else if (SENHA) verifica();
});
function iniciar() {                                    // roda depois de destrancar
  $('#gRepo').value = CFG.repo || ''; $('#gPath').value = CFG.path || 'data.json';
  $('#gTok').placeholder = CFG.token ? '(guardado, criptografado)' : '';
  go('inicio'); renderAll(); ghGet().then(() => { renderAll(); verifica(); });
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');   // instalação e modo offline
