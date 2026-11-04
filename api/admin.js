// Painel de administração: confere a senha e grava config.json + fotos no GitHub
// em um único commit. A Vercel percebe o commit e republica o site sozinha.
//
// Variáveis de ambiente na Vercel:
//   ADMIN_SENHA   -> a senha do painel
//   GITHUB_TOKEN  -> token do GitHub com permissão "Contents: Read and write" neste repositório
//   (opcional) GITHUB_REPO = "usuario/repositorio" e GITHUB_BRANCH = "main"
const crypto = require('crypto');

function senhaOk(enviada) {
  const certa = process.env.ADMIN_SENHA || '';
  if (!certa || !enviada) return false;
  const a = crypto.createHash('sha256').update(String(enviada)).digest();
  const b = crypto.createHash('sha256').update(certa).digest();
  return crypto.timingSafeEqual(a, b);
}

function validar(cfg) {
  if (!cfg || !cfg.loja || !cfg.entrega || !Array.isArray(cfg.categorias)) throw new Error('Configuração incompleta');
  if (!Array.isArray(cfg.entrega.faixas) || !cfg.entrega.faixas.length) throw new Error('Cadastre ao menos uma faixa de frete');
  for (const c of cfg.categorias) for (const it of c.itens) {
    if (!it.id || !it.nome) throw new Error('Todo produto precisa de nome');
    if (!(it.preco >= 0)) throw new Error(`Preço inválido em ${it.nome}`);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  if (!senhaOk(req.headers['x-senha'])) return res.status(401).json({ erro: 'Senha incorreta' });
  if (body.acao === 'login') return res.status(200).json({ ok: true });

  try {
    validar(body.config);
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO || `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`;
    const branch = process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'main';
    if (!token) throw new Error('Falta configurar o GITHUB_TOKEN na Vercel');

    const gh = async (path, opts = {}) => {
      const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
        ...opts,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'link-de-pedidos', 'Content-Type': 'application/json' }
      });
      const d = await r.json();
      if (!r.ok) throw new Error(`GitHub: ${d.message || r.status}`);
      return d;
    };

    const ref = await gh(`/git/ref/heads/${branch}`);
    const base = await gh(`/git/commits/${ref.object.sha}`);

    const arquivos = [{ path: 'config.json', content: JSON.stringify(body.config, null, 2) + '\n', encoding: 'utf-8' }];
    for (const f of body.fotos || []) {
      if (!/^fotos\/[a-z0-9-]+\.jpg$/.test(f.path)) continue;
      arquivos.push({ path: f.path, content: String(f.data).replace(/^data:image\/\w+;base64,/, ''), encoding: 'base64' });
    }

    const tree = [];
    for (const a of arquivos) {
      const blob = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: a.content, encoding: a.encoding }) });
      tree.push({ path: a.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const novaArvore = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree }) });
    const commit = await gh('/git/commits', { method: 'POST', body: JSON.stringify({
      message: `Painel: atualiza cardápio${arquivos.length > 1 ? ` e ${arquivos.length - 1} foto(s)` : ''}`,
      tree: novaArvore.sha, parents: [ref.object.sha]
    }) });
    await gh(`/git/refs/heads/${branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
};
