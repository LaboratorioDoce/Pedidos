import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

function senhaOk(enviada) {
  const certa = process.env.ADMIN_SENHA || '';
  if (!certa || !enviada) return false;
  const a = crypto.createHash('sha256').update(String(enviada)).digest();
  const b = crypto.createHash('sha256').update(certa).digest();
  return crypto.timingSafeEqual(a, b);
}

export default async (req) => {
  const store = getStore({ name: 'loja', consistency: 'strong' });
  const atual = (await store.get('estoque', { type: 'json' })) || {};
  if (req.method === 'GET') return json({ estoque: atual });
  const body = await req.json().catch(() => ({}));

  if (body.acao === 'definir') {
    if (!senhaOk(req.headers.get('x-senha'))) return json({ erro: 'Senha incorreta' }, 401);
    const novo = {};
    for (const [id, q] of Object.entries(body.estoque || {})) {
      const n = parseInt(q, 10);
      if (id && Number.isFinite(n) && n >= 0) novo[id] = n;
    }
    await store.setJSON('estoque', novo);
    return json({ ok: true, estoque: novo });
  }

  if (body.acao === 'baixar') {
    const pedido = {};
    for (const l of body.itens || []) pedido[l.id] = (pedido[l.id] || 0) + Math.max(1, parseInt(l.qtd, 10) || 1);
    const faltando = Object.entries(pedido)
      .filter(([id, q]) => atual[id] != null && atual[id] < q)
      .map(([id]) => ({ id, disponivel: atual[id] }));
    if (faltando.length) return json({ erro: 'Estoque insuficiente', faltando, estoque: atual }, 409);
    for (const [id, q] of Object.entries(pedido)) if (atual[id] != null) atual[id] -= q;
    await store.setJSON('estoque', atual);
    return json({ ok: true, estoque: atual });
  }

  return json({ erro: 'Ação inválida' }, 400);
};
