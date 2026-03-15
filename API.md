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
