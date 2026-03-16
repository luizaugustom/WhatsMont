# Deploy do WhatsMont na VPS DigitalOcean

Guia passo a passo para hospedar o WhatsMont (painel + Evolution API) em um Droplet da DigitalOcean com Ubuntu, Nginx, SSL e PM2.

---

## Pré-requisitos

- Conta na [DigitalOcean](https://www.digitalocean.com)
- Domínio apontando para o IP do Droplet (opcional no início; pode usar IP para testar)
- Acesso SSH (chave recomendada)

---

## 1. Criar o Droplet

1. Acesse **DigitalOcean** → **Create** → **Droplets**.
2. **Imagem:** Ubuntu 22.04 LTS.
3. **Plano:** Basic Shared – o mais barato (ex.: $6/mês) é suficiente para começar.
4. **Região:** escolha a mais próxima dos seus usuários.
5. **Autenticação:** SSH Key (recomendado) ou senha.
6. **Nome do host:** ex. `whatsmont-prod`.
7. Clique em **Create Droplet**.

Anote o **IP público** do Droplet.

---

## 2. Conectar via SSH

No seu computador:

```bash
ssh root@SEU_IP_DO_DROPLET
```

(Substitua `SEU_IP_DO_DROPLET` pelo IP que anotou.)

Se preferir um usuário sem ser root (recomendado para produção), crie e use-o; nos comandos abaixo use `sudo` quando necessário.

---

## 3. Atualizar o sistema

```bash
apt update && apt upgrade -y
```

---

## 4. Instalar Node.js 18+

Use **uma** das opções abaixo. No Ubuntu 24.04 (Noble) a **Opção A** é a mais estável.

### Opção A: Repositório NodeSource manual (recomendado)

Não usa o script; você adiciona o repositório à mão. Funciona bem no Ubuntu 22.04 e 24.04:

```bash
apt install -y ca-certificates curl gnupg
mkdir -p /usr/share/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg
chmod 644 /usr/share/keyrings/nodesource.gpg

# Formato DEB822 (Ubuntu 24.04); em 22.04 também funciona
arch=$(dpkg --print-architecture)
cat <<EOF | tee /etc/apt/sources.list.d/nodesource.sources > /dev/null
Types: deb
URIs: https://deb.nodesource.com/node_20.x
Suites: nodistro
Components: main
Architectures: $arch
Signed-By: /usr/share/keyrings/nodesource.gpg
EOF

apt update
apt install -y nodejs
node -v   # deve mostrar v20.x
npm -v
```

### Opção B: Script do NodeSource

**Importante:** o comando precisa ter `| sudo -E bash -` no final. Sem isso o `curl` só **mostra** o script e não executa.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
node -v
npm -v
```

### Opção C: NVM (Node Version Manager)

Se as opções A e B falharem, use NVM (instala o Node no seu usuário):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc   # ou feche e abra o terminal
nvm install 20
nvm use 20
node -v
npm -v
```

Depois instale o PM2 globalmente com: `npm install -g pm2` (já na seção 6).

---

## 5. Instalar Docker e Docker Compose

```bash
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

docker --version
docker compose version
```

---

## 6. Instalar PM2 (process manager)

```bash
npm install -g pm2
pm2 --version
```

---

## 7. Instalar Nginx e Certbot (SSL)

```bash
apt install -y nginx certbot python3-certbot-nginx
systemctl enable nginx
```

---

## 8. Enviar o projeto para a VPS

Escolha uma das opções.

### Opção A: Git (recomendado se o código está em repositório)

Na VPS:

```bash
apt install -y git
mkdir -p /var/www
cd /var/www
git clone https://github.com/SEU_USUARIO/WhatsMont.git whatsmont
cd whatsmont
```

(Substitua a URL pelo seu repositório.)

### Opção B: Enviar via SCP do seu PC

No **seu computador** (PowerShell ou terminal), na pasta do projeto:

```bash
scp -r . root@SEU_IP_DO_DROPLET:/var/www/whatsmont
```

Depois, na VPS:

```bash
cd /var/www/whatsmont
```

### Opção C: Compactar, enviar e descompactar

No seu PC:

```bash
# Excluir node_modules e .env
tar --exclude='node_modules' --exclude='.env' --exclude='data' -czvf whatsmont.tar.gz .
scp whatsmont.tar.gz root@SEU_IP_DO_DROPLET:/var/www/
```

Na VPS:

```bash
mkdir -p /var/www/whatsmont
cd /var/www/whatsmont
tar -xzvf /var/www/whatsmont.tar.gz -C .
```

---

## 9. Instalar dependências e configurar ambiente

Na VPS, dentro de `/var/www/whatsmont`:

```bash
cd /var/www/whatsmont
npm ci --omit=dev
cp .env.example .env
npm run ensure-env
```

**Guarde a chave master** que aparecer no terminal (ou leia em `.master-key.txt`). Você usará para login no painel.

Edite o `.env` para produção:

```bash
nano .env
```

Ajuste (ou confira) estas linhas:

```env
NODE_ENV=production
EVOLUTION_API_URL=http://127.0.0.1:8080
EVOLUTION_API_KEY=<a mesma que o ensure-env gerou – já deve estar preenchida>
PORT=3000
CORS_ORIGIN=https://seudominio.com
DB_PATH=/var/lib/whatsmont/data/whatsmont.db
```

Salve (Ctrl+O, Enter, Ctrl+X no nano).

Crie o diretório do banco e permissões:

```bash
mkdir -p /var/lib/whatsmont/data
chown -R $USER /var/lib/whatsmont
```

---

## 10. Rodar migrations

```bash
cd /var/www/whatsmont
npm run migrate
```

---

## 11. Subir a Evolution API (Docker)

O `docker-compose.yml` já está configurado para expor a Evolution **apenas em localhost** (porta 8080).

```bash
cd /var/www/whatsmont
docker compose up -d evolution-api
```

Verifique:

```bash
docker ps
curl -s -H "apikey: SUA_EVOLUTION_API_KEY" http://127.0.0.1:8080/instance/fetchInstances
```

(Substitua `SUA_EVOLUTION_API_KEY` pela chave do `.env`.)

---

## 12. Subir o painel com PM2

```bash
cd /var/www/whatsmont
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

**Execute o comando** que o `pm2 startup` mostrar (algo como `sudo env PATH=... pm2 startup systemd -u root --hp /root`). Isso faz o painel subir automaticamente após reinício do servidor.

Verifique:

```bash
pm2 status
curl -s http://127.0.0.1:3000/api/v1/health
```

---

## 13. Configurar Nginx (proxy reverso)

Crie o site:

```bash
nano /etc/nginx/sites-available/whatsmont
```

Conteúdo do arquivo (use **apenas** o bloco abaixo; não escreva nada como `nano` ou `nginx` dentro do arquivo):

- **Com domínio:** troque `seudominio.com` pelo seu domínio.
- **Só com IP:** troque `seudominio.com` pelo IP do servidor (ex.: `134.199.187.88`).
- O `proxy_pass` deve ser sempre `http://127.0.0.1:3000` (aplicação local).

```nginx
server {
    listen 80;
    server_name 134.199.187.88;
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

Ative o site e teste a configuração:

```bash
ln -s /etc/nginx/sites-available/whatsmont /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

Se estiver usando **domínio**, instale o SSL com Certbot:

```bash
certbot --nginx -d seudominio.com
```

Siga as perguntas (e-mail, termos). O Certbot ajusta o Nginx para HTTPS automaticamente.

Se estiver **só com IP**, acesse por enquanto com `http://SEU_IP`.

---

## 14. Firewall (UFW)

Deixe acessíveis apenas SSH, HTTP e HTTPS:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

As portas 3000 (painel) e 8080 (Evolution) **não** precisam estar abertas na internet; o Nginx faz proxy apenas para 127.0.0.1.

---

## 15. Checklist final

- [ ] `.env` com `NODE_ENV=production`, `CORS_ORIGIN` com seu domínio, `DB_PATH=/var/lib/whatsmont/data/whatsmont.db`
- [ ] Evolution API rodando: `docker ps` e `curl` em `http://127.0.0.1:8080`
- [ ] Painel rodando: `pm2 status` e `curl http://127.0.0.1:3000/api/v1/health`
- [ ] `pm2 save` e `pm2 startup` executados
- [ ] Nginx ativo com proxy para a porta 3000
- [ ] SSL instalado (Certbot) se estiver usando domínio
- [ ] UFW liberando só SSH + Nginx (80/443)
- [ ] Login no painel com a MASTER_KEY em `https://seudominio.com` (ou `http://SEU_IP`)

---

## Atualizando o projeto depois

Se usar Git:

```bash
cd /var/www/whatsmont
git pull
npm ci --omit=dev
npm run migrate
pm2 restart whatsmont
```

Se a Evolution tiver nova imagem desejada, atualize o `docker-compose.yml` e rode:

```bash
docker compose pull evolution-api
docker compose up -d evolution-api
```

---

## Comandos úteis

| Ação              | Comando |
|-------------------|--------|
| Ver logs do painel | `pm2 logs whatsmont` |
| Reiniciar painel   | `pm2 restart whatsmont` |
| Status Evolution   | `docker ps` / `docker logs evolution-api` |
| Reiniciar Evolution | `docker restart evolution-api` |
| Ver chave master  | `cat /var/www/whatsmont/.master-key.txt` (se existir) |

---

## Problemas comuns

- **502 Bad Gateway:** o painel não está rodando. Verifique `pm2 status` e `pm2 logs whatsmont`.
- **Evolution não responde:** confira `docker ps` e `docker logs evolution-api`. Confirme `EVOLUTION_API_URL=http://127.0.0.1:8080` e `EVOLUTION_API_KEY` no `.env`.
- **CORS ao acessar de outro domínio:** adicione a origem em `CORS_ORIGIN` no `.env` (vírgula entre múltiplas origens) e reinicie o painel: `pm2 restart whatsmont`.

Para mais detalhes do aplicativo (uso, API, persistência), veja o [README.md](README.md).
