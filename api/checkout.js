// Cria o pagamento no Mercado Pago (Checkout Pro: cartão de crédito, débito e Pix).
// O total é recalculado aqui no servidor a partir do config.json, então ninguém
// consegue alterar o preço pelo navegador.
const config = require('../config.json');

function acharItem(id) {
  for (const c of config.categorias) for (const it of c.itens) if (it.id === id) return it;
  return null;
}

function precoLinha(linha) {
  const it = acharItem(linha.id);
  if (!it) throw new Error('Item inexistente: ' + linha.id);
  if (it.disponivel === false) throw new Error(`${it.nome} está esgotado`);
  let unit = it.preco;
  for (const o of linha.opcoes || []) {
    const g = it.opcoes.find(g => g.titulo === o.grupo);
    const op = g && g.itens.find(x => x.nome === o.nome);
    if (!op) throw new Error('Opção inválida em ' + it.nome);
    unit += op.preco;
  }
  const qtd = Math.max(1, Math.min(50, parseInt(linha.qtd, 10) || 1));
  return { titulo: it.nome, unit, qtd };
}

function distanciaKm(a, b, c, d) {
  const R = 6371, r = x => x * Math.PI / 180, dl = r(c - a), dn = r(d - b);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function freteDoCep(cep) {
  const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (!r.ok) throw new Error('CEP não encontrado');
  const d = await r.json();
  let lat, lng;
  const co = d.location && d.location.coordinates;
  if (co && co.latitude) { lat = +co.latitude; lng = +co.longitude; }
  else {
    const q = encodeURIComponent([d.street, d.neighborhood, d.city, d.state, 'Brasil'].filter(Boolean).join(', '));
    const n = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${q}`,
      { headers: { 'User-Agent': 'loja-pedidos/1.0' } }).then(r => r.json());
    if (!n[0]) throw new Error('Endereço não localizado');
    lat = +n[0].lat; lng = +n[0].lon;
  }
  const km = distanciaKm(config.loja.lat, config.loja.lng, lat, lng) * config.entrega.fatorRua;
  const faixa = config.entrega.faixas.find(f => +km.toFixed(1) <= f.ateKm);
  if (!faixa) throw new Error('Fora da área de entrega');
  return faixa.valor;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const linhas = (body.itens || []).map(precoLinha);
    if (!linhas.length) throw new Error('Sacola vazia');

    const sub = linhas.reduce((s, l) => s + l.unit * l.qtd, 0);
    const frete = body.modo === 'entrega' ? await freteDoCep(String(body.cep).replace(/\D/g, '')) : 0;
    let desc = 0;
    const cupom = body.cupom && config.cupons[body.cupom];
    if (cupom) {
      if (cupom.tipo === 'percentual') desc = +(sub * cupom.valor / 100).toFixed(2);
      if (cupom.tipo === 'frete') desc = frete;
      if (cupom.tipo === 'fixo') desc = Math.min(cupom.valor, sub);
    }
    const total = Math.max(0, +(sub + frete - desc).toFixed(2));
    if (config.loja.pedidoMinimo && sub < config.loja.pedidoMinimo) throw new Error('Pedido abaixo do mínimo');

    const id = String(body.id || '').replace(/[^A-Z0-9]/gi, '').slice(0, 12);
    const origem = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const resumo = linhas.map(l => `${l.qtd}x ${l.titulo}`).join(', ').slice(0, 250);

    const mp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      body: JSON.stringify({
        items: [{ title: `Pedido #${id} — ${config.loja.nome}`, description: resumo, quantity: 1, unit_price: total, currency_id: 'BRL' }],
        external_reference: id,
        statement_descriptor: config.loja.nome.normalize('NFD').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 13),
        payment_methods: { excluded_payment_types: [{ id: 'ticket' }], installments: 1 },
        back_urls: {
          success: `${origem}/?status=approved&pedido=${id}`,
          pending: `${origem}/?status=pending&pedido=${id}`,
          failure: `${origem}/?status=failure&pedido=${id}`
        },
        auto_return: 'approved'
      })
    });
    const pref = await mp.json();
    if (!mp.ok) throw new Error(pref.message || 'Erro no Mercado Pago');
    res.status(200).json({ url: pref.init_point, total });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
};
