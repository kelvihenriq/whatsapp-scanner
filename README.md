# Scanner de WhatsApp (somente leitura)

Programa que fica ligado num servidor, conectado ao seu WhatsApp (como o WhatsApp Web), e conta **quantas fotos chegam por grupo por dia**. Grava no Supabase (tabela `app_state`, a mesma do site) os **números** e a **legenda das fotos** (ex: "143 / Splice 2 / Ring", no máximo 200 caracteres). **Não baixa as fotos, não guarda nenhuma outra mensagem de texto e nunca envia mensagem.**

## Como colocar no ar (Railway — o mais simples)

1. Crie uma conta em railway.app e um projeto novo **a partir de uma pasta/repositório** com o conteúdo desta pasta (`index.js`, `logic.js`, `package.json`).
2. Em **Variables**, adicione:
   - `SUPABASE_URL` — a URL do Supabase **do site onde você quer ver a aba** (C3 / `index.html`: `https://htawihydefatzxsilngw.supabase.co` · Stevens / `CONTROLE_corrigido.html`: `https://xsgudmgnvifzwqbmilgz.supabase.co`). Cada site usa um projeto diferente, e este programa grava em um só.
   - `SUPABASE_KEY` — a mesma chave *anon* que esse site usa (constante `SUPABASE_ANON_KEY` no código dele)
   - `TIMEZONE` — ex: `America/Sao_Paulo` (define quando "vira o dia")
   - `AUTH_DIR` — `/data/auth`
3. Em **Volumes**, crie um volume montado em `/data`. **Isso é importante:** é onde fica a sessão do WhatsApp. Sem o volume, toda vez que o servidor reiniciar você teria que ler o QR code de novo.
4. Comando de start: `npm start` (Railway detecta sozinho).

## Conectar o WhatsApp

1. No site, abra a aba **WHATSAPP**. Vai aparecer um QR code.
2. No celular: WhatsApp → **Aparelhos conectados** → **Conectar um aparelho** → leia o QR.
3. Na aba, marque **quais grupos acompanhar**. Enquanto nenhum grupo for marcado, nada é contado.

## Cuidados

- A conexão **não é oficial** (usa a biblioteca Baileys). Por isso o programa só lê. Mesmo assim existe risco do WhatsApp bloquear o número; o ideal é usar um número que você possa perder.
- Abra o WhatsApp no celular pelo menos a cada 2 semanas, senão o aparelho conectado cai e é preciso ler o QR de novo.
- Só conta fotos que chegam **depois** que o grupo é marcado (e o que o WhatsApp sincronizar na hora).

## Testar a contagem

`npm install && npm test` (testa só a lógica de contagem, sem WhatsApp).
