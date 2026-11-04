# Seu link de pedidos — como colocar no ar (grátis)

## O que tem aqui
- `index.html` — a loja que o cliente vê (cardápio, sacola, frete, Pix, cartão)
- `admin.html` — o painel onde você edita tudo pelo celular: `seusite.vercel.app/admin`
- `config.json` — onde o painel grava cardápio, preços, frete etc. (você não precisa abrir)
- `api/` — a parte que fala com o Mercado Pago e com o painel

## 1. Suba no GitHub
1. Crie uma conta em https://github.com → **New repository** → nome `pedidos` → **Create repository**
2. Clique em **uploading an existing file** e arraste o *conteúdo* desta pasta (os arquivos e a pasta `api`) → **Commit changes**

## 2. Publique na Vercel
1. Entre em https://vercel.com com a conta do GitHub → **Add New → Project** → escolha `pedidos` → **Deploy**
2. Seu link: `pedidos.vercel.app` (ou o nome que estiver livre). Domínio próprio em **Settings → Domains**

## 3. Configure 3 variáveis (Vercel → Settings → Environment Variables)
| Nome | Valor |
|---|---|
| `ADMIN_SENHA` | a senha que você vai usar no painel |
| `GITHUB_TOKEN` | token do GitHub (passo abaixo) |
| `MP_ACCESS_TOKEN` | Access Token do Mercado Pago (passo abaixo) |

Depois de salvar as três: **Deployments → ⋯ → Redeploy**.

**Token do GitHub** (é o que deixa o painel salvar as alterações):
github.com → sua foto → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
Em *Repository access* escolha **Only select repositories → pedidos**; em *Permissions → Contents* escolha **Read and write**. Validade: a maior disponível (anote para renovar).

**Token do Mercado Pago**:
https://www.mercadopago.com.br/developers/panel → **Criar aplicação** (Checkout Pro) → **Credenciais de produção** → copie o **Access Token** (`APP_USR-...`). Para testar sem cobrar, use antes as credenciais de teste.

## 4. Use o painel
Acesse `seusite/admin`, entre com a senha e edite: produtos, fotos (tire do celular, o painel já corta e comprime), adicionais, esgotado, categorias, faixas de frete, horários, cupons, chave Pix e WhatsApp.
Toque em **Publicar**: em cerca de 1 minuto a loja está atualizada.

## Como os pagamentos funcionam
- **Pix direto**: cai na sua conta, sem taxa. O cliente envia o comprovante no WhatsApp junto com o pedido. Confira o extrato antes de despachar
- **Cartão**: checkout do Mercado Pago. Aprovado, o cliente volta e envia o pedido no WhatsApp. Confirme no app do Mercado Pago antes de despachar
- O frete é calculado pelo CEP (BrasilAPI + OpenStreetMap, gratuitos); a distância é uma estimativa
