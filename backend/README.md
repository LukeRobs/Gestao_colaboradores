# 🚀 Backend - Sistema de Gestão de Colaboradores

Sistema backend completo para gestão de colaboradores, frequência, produção e operações.

## 📋 Tecnologias

- **Node.js** + Express
- **PostgreSQL** (Render)
- **Prisma ORM**
- **Google Sheets API**
- **JWT Authentication**
- **Cloudflare R2** (Storage)
- **Node-cron** (Jobs agendados)

## 🚀 Início Rápido

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Configure o arquivo `.env` com suas credenciais:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
GOOGLE_CLIENT_EMAIL="..."
GOOGLE_PRIVATE_KEY="..."
```

### 3. Aplicar Migrations

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Iniciar Servidor

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## 📚 Documentação

- **[DOCUMENTACAO.md](./DOCUMENTACAO.md)** - Documentação completa do sistema
- **[ALERTA_SALVAMENTO_README.md](./ALERTA_SALVAMENTO_README.md)** - Sistema de alertas de salvamento
- **[API-COLLECTION.json](./API-COLLECTION.json)** - Collection para Postman/Insomnia

## 🛠️ Scripts Úteis

```bash
# Verificar status dos salvamentos
node verificar-status-salvamentos.js

# Prisma Studio (visualizar banco)
npx prisma studio

# Gerar Prisma Client
npx prisma generate

# Aplicar migrations
npx prisma migrate deploy
```

## ⚙️ Sistema de Salvamento Automático

O sistema salva automaticamente dados de produção por hora:

| Turno | Horário | Descrição |
|-------|---------|-----------|
| T1    | 15:00   | Turno manhã (06h-14h) |
| T2    | 23:00   | Turno tarde (14h-22h) |
| T3    | 05:00   | Turno noite (22h-06h) |

**Alerta de Falha:** Se algum salvamento falhar, um alerta aparece no dashboard com opção de salvamento manual.

## 📁 Estrutura

```
backend/
├── prisma/              # Schema e migrations
├── src/
│   ├── config/         # Configurações
│   ├── controllers/    # Controllers
│   ├── jobs/           # Jobs agendados (cron)
│   ├── middlewares/    # Middlewares
│   ├── routes/         # Rotas
│   ├── services/       # Serviços (Google Sheets, etc)
│   └── utils/          # Utilitários
├── .env                # Variáveis de ambiente
└── package.json
```

## 🔐 Autenticação

O sistema usa JWT. Inclua o token no header:

```
Authorization: Bearer <token>
```

## 📊 Principais Endpoints

### Autenticação
- `POST /auth/login` - Login
- `POST /auth/register` - Registro

### Colaboradores
- `GET /colaboradores` - Listar
- `POST /colaboradores` - Criar
- `PUT /colaboradores/:id` - Atualizar

### Frequência
- `GET /frequencia` - Listar
- `POST /frequencia` - Registrar

### Gestão Operacional
- `GET /dashboard/gestao-operacional` - Dashboard
- `GET /dashboard/gestao-operacional/historico` - Histórico
- `GET /dashboard/gestao-operacional/status-salvamentos` - Status
- `POST /dashboard/gestao-operacional/salvar-historico` - Salvar manual

## 🐛 Debug

Logs detalhados são exibidos no console. Para mais informações, consulte a [documentação completa](./DOCUMENTACAO.md).

## 📝 Licença

Proprietary - Uso interno apenas
