# API WhatsMont

Base URL: `/api/v1`

Respostas de sucesso: `{ "success": true, "data": ... }`. Erros: `{ "success": false, "error": "mensagem" }`.

---

## Health (público)

### GET /health

Health check para proxy reverso e monitoramento. Não exige autenticação.

**Resposta:** `{ "success": true, "data": { "status": "ok", "evolution": true|false } }`

- `evolution`: `true` se a Evolution API estiver acessível; `false` caso contrário. O app sempre retorna 200 quando está no ar.

---

## Autenticação Admin

Use a chave master em todas as requisições de admin:

```
Authorization: Bearer <MASTER_KEY>
```

---

## Auth

### POST /auth/login

Login (obter token para usar no header nas demais requisições admin). O corpo pode ser usado pelo painel; a API admin aceita diretamente o Bearer com a chave master.

**Body:** `{ "key": "sua-chave-master" }` ou `{ "masterKey": "sua-chave-master" }`

**Resposta:** `{ "success": true, "token": "sua-chave-master" }`

---

## Instâncias (Admin)

### GET /instances

Lista todas as instâncias (com status atual da Evolution).

**Headers:** `Authorization: Bearer <MASTER_KEY>`

**Resposta:** `{ "success": true, "data": [ { "id", "evolution_instance_name", "evolution_instance_id", "label", "status", ... } ] }`

### GET /instances/:id

Detalhe de uma instância + status.

**Resposta:** `{ "success": true, "data": { ... } }`

### GET /instances/:id/qr

Obtém o QR Code atual da instância (proxy para Evolution connect).

**Resposta:** `{ "success": true, "data": { "base64"?: "...", "code"?: "..." } }` (formato conforme Evolution API)

### POST /instances

Cria uma nova instância na Evolution e registra no painel.

**Body:**
- `instanceName` (obrigatório): nome único da instância
- `label` (opcional): nome amigável
- `integration` (opcional): `WHATSAPP-BAILEYS` (padrão) ou `WHATSAPP-BUSINESS`
- `qrcode` (opcional): `true` para gerar QR após criar (padrão `true`)

**Resposta:** `{ "success": true, "data": { "id", "evolution_instance_name", "label", ... } }`

### DELETE /instances/:id

Remove a instância na Evolution e no banco.

**Resposta:** `{ "success": true, "data": { "ok": true } }`

---

## Tokens (Admin)

### GET /tokens

Lista todos os tokens (máscara, label, instância, ativo).

**Headers:** `Authorization: Bearer <MASTER_KEY>`

**Resposta:** `{ "success": true, "data": [ { "id", "token_mask", "label", "instance_id", "instance_label", "active", ... } ] }`

### GET /tokens/:id

Detalhe de um token (sem o valor em claro).

### POST /tokens

Cria um novo token. O valor em claro é retornado **apenas nesta resposta**.

**Body:**
- `label` (obrigatório): nome/descrição do token
- `instance_id` (obrigatório): ID da instância à qual o token está vinculado

**Resposta:** `{ "success": true, "data": { "id", "label", "instance_id", "token", "token_mask", "active", "created_at" } }`

### PATCH /tokens/:id

Atualiza token: `label`, `instance_id` ou `active` (revogar = `active: false`).

**Body:** `{ "label"?: "...", "instance_id"?: number, "active"?: boolean }`

### DELETE /tokens/:id

Exclui o token do banco.

**Resposta:** `{ "success": true, "data": { "ok": true } }`

---

## Conexão (Sistemas externos)

Autenticação por token de conexão (criado no painel):

```
Authorization: Bearer <TOKEN_DE_CONEXÃO>
```

Cada token está vinculado a uma instância. O sistema externo só acessa essa instância.

### GET /connection/status

Status da instância vinculada ao token (conectado / desconectado / aguardando QR).

**Resposta:** `{ "success": true, "data": { "state": "open"|"close"|"connecting"|..., "instanceName": "..." } }`

### GET /connection/qr

Obtém o QR Code da instância vinculada ao token (para conectar o WhatsApp).

**Resposta:** `{ "success": true, "data": { "base64"?: "...", "code"?: "..." } }` (formato conforme Evolution API)

---

## Exemplos

**Listar instâncias (admin):**
```bash
curl -H "Authorization: Bearer sua-chave-master" http://localhost:3000/api/v1/instances
```

**Criar token (admin):**
```bash
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer sua-chave-master" \
  -d '{"label":"Meu Sistema","instance_id":1}' http://localhost:3000/api/v1/tokens
```

**Status da conexão (sistema externo):**
```bash
curl -H "Authorization: Bearer token-retornado-ao-criar" http://localhost:3000/api/v1/connection/status
```

**QR Code (sistema externo):**
```bash
curl -H "Authorization: Bearer token-retornado-ao-criar" http://localhost:3000/api/v1/connection/qr
```

---

## Configuração em APIs externas para envio de mensagens

O WhatsMont gerencia **instâncias** e **tokens** (status e QR). O **envio de mensagens** é feito **diretamente na Evolution API**. Nas suas APIs externas, configure o seguinte.

### 1. No painel WhatsMont (admin)

1. Acesse o painel e faça login com a **MASTER_KEY**.
2. Crie uma **instância** (uma por número WhatsApp) e conecte escaneando o QR.
3. Em **Tokens** → **Criar token**: informe **label** (ex.: "Meu CRM") e **instance_id** da instância.
4. **Copie o token** retornado (exibido só uma vez) e guarde em variável de ambiente na sua API externa (ex.: `WHATSMONT_TOKEN`).

### 2. Na sua API externa – variáveis/config

Guarde estes valores (ex.: em `.env` ou secrets):

| Variável | Descrição |
|----------|-----------|
| `WHATSMONT_BASE_URL` | URL do painel, ex.: `https://seudominio.com` (sem `/api/v1`) |
| `WHATSMONT_TOKEN` | Token de conexão criado no painel (Bearer usado nos endpoints de conexão) |
| `EVOLUTION_BASE_URL` | URL da Evolution API (veja abaixo) |
| `EVOLUTION_API_KEY` | Chave da Evolution (a mesma do `.env` do servidor WhatsMont, `EVOLUTION_API_KEY`) |

- Para **status e QR**: sua API usa só `WHATSMONT_BASE_URL` + `WHATSMONT_TOKEN` nos endpoints abaixo.
- Para **enviar mensagens**: sua API chama a **Evolution API** usando `EVOLUTION_BASE_URL` + `EVOLUTION_API_KEY` + **nome da instância** (obtido do status).

### 3. Endpoints WhatsMont (status e QR)

Use o token em todas as requisições:

- **Base:** `GET {WHATSMONT_BASE_URL}/api/v1/connection/status`
- **Header:** `Authorization: Bearer {WHATSMONT_TOKEN}`

A resposta inclui `instanceName` — esse valor é usado na Evolution para enviar mensagens.

Exemplo de resposta:
```json
{ "success": true, "data": { "state": "open", "instanceName": "minha-instancia" } }
```

### 4. Envio de mensagens via Evolution API

Sua API externa deve chamar a **Evolution API** (não o WhatsMont):

- **Obter o nome da instância:** `GET {WHATSMONT_BASE_URL}/api/v1/connection/status` com `Authorization: Bearer {WHATSMONT_TOKEN}` → usar `data.instanceName`.
- **Enviar texto:**  
  `POST {EVOLUTION_BASE_URL}/message/sendText/{instanceName}`  
  - **Headers:** `apikey: {EVOLUTION_API_KEY}`, `Content-Type: application/json`  
  - **Body (JSON):** `{ "number": "5511999999999", "text": "Sua mensagem" }`  
  - Número com código do país, sem `+`.

Exemplo (curl):
```bash
curl -X POST "https://evolution.seudominio.com/message/sendText/minha-instancia" \
  -H "apikey: SUA_EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"number":"5511999999999","text":"Olá!"}'
```

### 5. Expor a Evolution para a API externa (quando não está no mesmo servidor)

Por padrão a Evolution fica só em `127.0.0.1:8080` no servidor. Se sua **API externa roda em outro servidor**, é preciso expor a Evolution (ex.: por Nginx) e usar a mesma `EVOLUTION_API_KEY`:

1. No Nginx do servidor onde roda a Evolution, crie um vhost (ex.: `evolution.seudominio.com`) fazendo proxy para `http://127.0.0.1:8080`.
2. Instale SSL (Certbot) para esse subdomínio.
3. Na sua API externa defina:
   - `EVOLUTION_BASE_URL=https://evolution.seudominio.com`
   - `EVOLUTION_API_KEY` = valor do `EVOLUTION_API_KEY` do `.env` do WhatsMont (recomendado: repasse por variável de ambiente/secrets, nunca em código).

Se a **API externa rodar no mesmo servidor** que o WhatsMont/Evolution, pode usar:

- `EVOLUTION_BASE_URL=http://127.0.0.1:8080`
- `EVOLUTION_API_KEY` = mesmo valor do `.env` do projeto.

### Resumo rápido

1. **Painel:** criar instância → conectar WhatsApp → criar token → guardar token.
2. **API externa:** configurar `WHATSMONT_BASE_URL`, `WHATSMONT_TOKEN`, `EVOLUTION_BASE_URL`, `EVOLUTION_API_KEY`.
3. **Status/QR:** `GET .../api/v1/connection/status` e `.../connection/qr` no WhatsMont com o token.
4. **Enviar mensagem:** obter `instanceName` do status; `POST {EVOLUTION_BASE_URL}/message/sendText/{instanceName}` com `apikey` e body `number` + `text`.
