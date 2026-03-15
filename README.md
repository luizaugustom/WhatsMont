# WhatsMont

Painel central para gerenciar múltiplas instâncias da **Evolution API** (WhatsApp) e tokens de conexão para sistemas externos. A Evolution API roda no mesmo servidor (Docker); o painel e a API REST ficam em Node.js. **Não é necessário configurar .env ou keys manualmente:** na primeira execução (`npm start` ou `npm run start:all`) as chaves são geradas e salvas em `.env` e em `.master-key.txt`. Evolution e painel podem ser iniciados juntos com um único comando.

## Requisitos

- Node.js 18+
- Docker e Docker Compose (para Evolution API)
- PM2 (recomendado em produção)
- Nginx ou Apache (proxy reverso e SSL)

## Início rápido (Evolution + painel juntos, chaves automáticas)

Um único comando sobe a Evolution API e o painel; as chaves são geradas automaticamente na primeira execução.

```bash
cd /caminho/do/projeto
npm ci
npm run migrate
npm run start:all
```

- Na **primeira vez**, o sistema gera `MASTER_KEY` e `EVOLUTION_API_KEY` automaticamente no `.env` e exibe a chave master no terminal (também salva em `.master-key.txt`). Use essa chave para acessar o painel. Em produção o mesmo: nenhuma configuração manual de keys é obrigatória.
- O script sobe o container da Evolution (Docker) e em seguida inicia o painel na porta 3000.
- Em **produção**, não use `start-all.js` no PM2 (Docker e Node no mesmo processo atrapalha reinício). Suba a Evolution com `docker compose up -d evolution-api` e o painel com `pm2 start ecosystem.config.cjs`.

## Produção na VPS (HostGator ou similar)

### Requisitos na VPS

- Acesso SSH (root ou usuário com sudo).
- Node.js 18+ (instale se não tiver: `apt update && apt install -y nodejs npm` ou use nvm).
- Docker e Docker Compose (se a sua VPS permitir; na HostGator confirme com o suporte). Se não houver Docker, veja **VPS sem Docker** mais abaixo.
- PM2: `npm install -g pm2`.
- Nginx ou Apache (proxy reverso) e Certbot para SSL.

### Passo a passo de deploy

**1. Enviar o projeto** para o servidor (ex.: `/var/www/whatsmont` ou `~/whatsmont`).

```bash
cd /var/www/whatsmont
```

**2. Instalar dependências:**

```bash
npm ci --omit=dev
```

**3. Configurar variáveis de ambiente:**

```bash
cp .env.example .env
npm run ensure-env
```

Guarde a chave exibida (ou em `.master-key.txt`). Edite o `.env` para produção:

- `NODE_ENV=production`
- `EVOLUTION_API_URL=http://127.0.0.1:8080`
- `EVOLUTION_API_KEY=` (a mesma gerada pelo `ensure-env`)
- `PORT=3000`
- `CORS_ORIGIN=https://seudominio.com,https://outra-api.com` (origens dos seus sistemas/dashboard, separadas por vírgula)
- `DB_PATH=/var/lib/whatsmont/data/whatsmont.db`

Crie o diretório do banco e permissões:

```bash
sudo mkdir -p /var/lib/whatsmont/data
sudo chown $USER /var/lib/whatsmont/data
```

**4. Rodar migrations:**

```bash
npm run migrate
```

**5. Subir a Evolution API (se Docker estiver disponível):**

```bash
docker compose up -d evolution-api
```

Verifique: `curl -H "apikey: SUA_EVOLUTION_API_KEY" http://127.0.0.1:8080/instance/fetchInstances`. **Não exponha a porta 8080 na internet** (apenas localhost).

**6. Subir o painel com PM2:**

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Execute o comando que o `pm2 startup` sugerir para iniciar o painel após reboot.

**7. Proxy reverso e SSL (Nginx):**

Crie o vhost (ex.: `/etc/nginx/sites-available/whatsmont`):

```nginx
server {
    listen 80;
    server_name seudominio.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ative o site, recarregue o Nginx e instale o SSL:

```bash
sudo certbot --nginx -d seudominio.com
```

**8. Firewall:** libere apenas as portas 80 e 443. Mantenha 3000 e 8080 apenas em localhost.

### Checklist final (produção)

- [ ] `.env` com `NODE_ENV=production`, `CORS_ORIGIN` com origens reais, `DB_PATH` persistente, `EVOLUTION_API_URL` correto.
- [ ] Evolution API rodando (Docker ou outro servidor) e acessível apenas pelo painel (localhost ou URL interna).
- [ ] Painel rodando com PM2; `pm2 save` e `pm2 startup` configurados.
- [ ] Nginx (ou Apache) com proxy para a porta do painel e SSL (HTTPS).
- [ ] Porta 8080 (Evolution) não exposta na internet.
- [ ] Instâncias criadas no painel; tokens criados e distribuídos para cada sistema externo.
- [ ] Nas APIs externas: base URL do painel + `Authorization: Bearer <token>` nos endpoints `/connection/status` e `/connection/qr`.

### VPS sem Docker (Evolution em outro servidor)

Se a HostGator (ou sua VPS) não permitir Docker, rode a Evolution API em **outro servidor** ou serviço. No `.env` do WhatsMont na VPS, defina:

- `EVOLUTION_API_URL=https://evolution.seudominio.com` (ou a URL onde a Evolution está rodando)

Configure CORS e API key na Evolution para aceitar requisições do seu painel. O restante do passo a passo (painel, PM2, Nginx, SSL) é igual.

---

## Persistência e recuperação (reinícios e quedas)

Para que **instâncias e conexões WhatsApp se mantenham** após reinício do servidor, queda de luz ou reinício do Docker/PM2, configure o seguinte.

### Evolution API (sessões WhatsApp)

O `docker-compose.yml` já usa **volumes nomeados** (`evolution_store` e `evolution_instances`). Eles guardam as sessões e instâncias no disco. Assim:

- Ao reiniciar o container (`docker restart evolution-api`) ou o servidor, as instâncias e conexões WhatsApp **continuam**; os usuários não precisam escanear o QR de novo.
- **Não remova** esses volumes (`docker volume rm ...`) nem use `docker compose down -v` se quiser manter os dados.

### Painel (instâncias e tokens no banco)

O painel grava instâncias e tokens no **SQLite** (arquivo definido por `DB_PATH` no `.env`). Para persistir após reinício:

- Use um **caminho em disco persistente** para o banco. O padrão `./data/whatsmont.db` é persistente enquanto o diretório do projeto existir no servidor.
- Em produção, pode usar um path absoluto, por exemplo: `DB_PATH=/var/lib/whatsmont/data/whatsmont.db` (crie o diretório e garanta permissão de escrita). Se mudar `DB_PATH`, rode `npm run migrate` para criar o banco no novo caminho.

### Reinício automático do painel (PM2)

Para o processo do painel voltar sozinho após reinício do **sistema operacional**:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Siga a mensagem do `pm2 startup` (copie e execute o comando que ele sugerir). Depois, a cada alteração nos processos do PM2, rode `pm2 save`.

### Resumo

| Componente        | Onde persiste                         | Ação recomendada                                                                 |
|------------------|---------------------------------------|-----------------------------------------------------------------------------------|
| Sessões WhatsApp | Volumes Docker (evolution_*)         | Manter `docker-compose.yml` com os volumes; não usar `down -v`                  |
| Instâncias/tokens| SQLite (`DB_PATH`)                    | Usar path persistente (ex.: `/var/lib/whatsmont/data/whatsmont.db`) em produção   |
| Processo do painel | PM2                               | `pm2 startup` + `pm2 save` para reinício automático após reboot do servidor      |

---

## Uso

1. Acesse o painel pela URL configurada (ex.: `https://seudominio.com`).
2. Faça login com a **chave master** (MASTER_KEY).
3. Crie **instâncias** (WhatsApp) e, se necessário, gere o QR Code para conectar.
4. Crie **tokens** vinculados a cada instância para sistemas externos.
5. Sistemas externos usam o token em `Authorization: Bearer <token>` nos endpoints `/api/v1/connection/status` e `/api/v1/connection/qr`.

**Página de conexão para sistemas externos:**  
Acesse com o token na query: `https://seudominio.com/connect?token=SEU_TOKEN` (ou `/?token=SEU_TOKEN`). A página exibe o QR Code e o status da conexão; o sistema externo pode usar essa URL para o usuário escanear o WhatsApp.

---

## Conectar suas APIs externas ao WhatsMont

### No painel (admin)

1. Acesse `https://seudominio.com` e faça login com a **MASTER_KEY**.
2. Crie as **instâncias** WhatsApp (uma por número/serviço).
3. Para cada sistema externo que vai usar uma instância:
   - Vá em **Tokens** → **Criar token**: informe **label** (ex.: "Sistema CRM") e **instance_id** (a instância desejada).
   - Copie o **token** retornado (exibido só uma vez) e guarde em variável de ambiente ou secrets do seu sistema.

### Nas suas APIs ou sistemas externos

- **Base URL:** `https://seudominio.com/api/v1`
- **Autenticação:** em todas as requisições ao WhatsMont use o header:
  - `Authorization: Bearer <token_gerado_no_painel>`
- **Endpoints úteis:**
  - `GET /connection/status` — ver se a instância está conectada (`state`: open, close, connecting, etc.).
  - `GET /connection/qr` — obter o QR Code para o usuário escanear (quando não conectado).

Para **enviar mensagens** ou **receber eventos** (mensagens recebidas, etc.), suas APIs devem falar **diretamente com a Evolution API** (não com o WhatsMont). Use a documentação da Evolution API para webhooks e envio de mensagens; o painel WhatsMont só gerencia instâncias e tokens para **status e QR**.

### Múltiplas instâncias e múltiplas APIs

- Cada **instância** = um número WhatsApp.
- Cada **token** = um vínculo com uma instância; você pode criar vários tokens para a mesma instância (um por sistema externo).
- Cada sistema externo usa seu próprio token em `Authorization: Bearer <token>` e enxerga apenas a instância daquele token (status e QR).

---

## Scripts

- `npm run start:all` – sobe a Evolution (Docker) e o painel juntos; gera chaves no `.env` na primeira execução.
- `npm run ensure-env` – garante que o `.env` existe e gera `MASTER_KEY` e `EVOLUTION_API_KEY` se estiverem vazios.
- `npm start` – inicia apenas o servidor do painel (produção).
- `npm run dev` – inicia com nodemon (desenvolvimento).
- `npm run migrate` – executa as migrations do banco SQLite.
- `npm test` – executa os testes de integração da API.

**Health check:** o endpoint `GET /api/v1/health` (sem autenticação) retorna 200 com `{ "success": true, "data": { "status": "ok", "evolution": true|false } }`. Use para proxy reverso e monitoramento.

---

## Testes

Os testes cobrem a API REST (auth, instâncias, tokens e connection) com Evolution simulada, sem Docker:

```bash
npm test
```

Cobertura: health; auth (login com key/masterKey, 401 para chave errada); instâncias (CRUD, QR, 400 sem instanceName, 409 nome duplicado, 404 id inválido); tokens (CRUD, revogar, 400 sem label/instance_id, 404 instance_id ou id inválido); connection (status e QR com token, 401 sem token ou token revogado/inválido); e testes unitários de env-utils. Total: 35+ testes.

---

## Documentação da API

Consulte [API.md](API.md) para a lista de endpoints (admin e sistemas externos), métodos HTTP e exemplos.

---

## Estrutura do projeto

- `src/config/` – configuração (env).
- `src/db/` – SQLite e migrations.
- `src/repositories/` – acesso a dados (instances, tokens).
- `src/services/` – regras de negócio e cliente Evolution.
- `src/middlewares/` – autenticação, rate limit, CORS, erro global.
- `src/routes/` – rotas da API.
- `src/app.js` – aplicação Express.
- `src/server.js` – bootstrap de env e listen.
- `src/ensure-env-bootstrap.js` – geração automática de chaves na subida do app (exceto em `NODE_ENV=test`).
- `test/integration/` – testes de integração; `test/fixtures/evolution-stub.js` – stub da Evolution API para testes.
- `public/` – painel web (HTML/CSS/JS).
- `docker-compose.yml` – Evolution API.
- `scripts/ensure-env.js` – geração automática de chaves no `.env`.
- `scripts/start-all.js` – sobe Evolution + painel em um único comando.
