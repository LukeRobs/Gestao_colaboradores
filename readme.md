# 🏢 Sistema de Gestão de Colaboradores

Sistema completo para gestão de colaboradores, controle de presença, escalas, treinamentos e muito mais.

## 🚀 Funcionalidades Principais

### 👥 Gestão de Colaboradores
- Cadastro completo de colaboradores
- Controle de contratos e vínculos
- Gestão de cargos e setores
- Histórico de movimentações

### ⏰ Controle de Presença
- Registro de ponto por CPF
- Controle de presença mensal
- Ajustes manuais de presença
- **✨ NOVO: Exportação automática para Google Sheets**

### 📊 Dashboards
- Dashboard administrativo
- Dashboard operacional
- Dashboard de colaboradores
- Métricas e indicadores em tempo real

### 📚 Treinamentos
- Gestão de treinamentos
- Controle de participantes
- Geração de atas
- Histórico de capacitações

### 🏥 Gestão de Ausências
- Atestados médicos
- Faltas justificadas
- Licenças
- Acidentes de trabalho

### 📈 Relatórios
- Daily Work (DW)
- Escalas e turnos
- Medidas disciplinares
- Frequência e absenteísmo

## ✨ Novidade: Exportação Automática para Google Sheets

### 🎯 O Que É?
Sistema que exporta automaticamente o controle de presença para uma planilha do Google Sheets, mantendo os dados sempre atualizados.

### 🔄 Funcionalidades
- **Sincronização Automática:** A cada 5 minutos
- **Exportação Manual:** Botão na interface com filtros
- **Formatação Automática:** Planilha formatada e organizada
- **Abertura Automática:** Planilha abre após exportação

### 📚 Documentação Completa
- **Início Rápido:** [INICIO_RAPIDO.md](INICIO_RAPIDO.md) (2 minutos)
- **Guia Completo:** [README_EXPORTACAO_SHEETS.md](README_EXPORTACAO_SHEETS.md)
- **Índice:** [INDICE_DOCUMENTACAO.md](INDICE_DOCUMENTACAO.md)

### 🚀 Como Começar
```bash
# 1. Configurar permissões (ver INICIO_RAPIDO.md)
# 2. Testar conexão
cd backend
npm run test:sheets

# 3. Iniciar servidor
npm run dev
```

## 🛠️ Tecnologias

### Backend
- **Node.js** + Express
- **PostgreSQL** + Prisma ORM
- **JWT** para autenticação
- **Google Sheets API** para exportação
- **node-cron** para jobs automáticos

### Frontend
- **React** + Vite
- **TailwindCSS** para estilização
- **Axios** para requisições
- **Lucide React** para ícones

## 📁 Estrutura do Projeto

```
/
├── backend/                    # API Node.js
│   ├── src/
│   │   ├── controllers/       # Controladores
│   │   ├── services/          # Serviços (incluindo Google Sheets)
│   │   ├── jobs/              # Jobs automáticos
│   │   ├── routes/            # Rotas da API
│   │   ├── middlewares/       # Middlewares
│   │   └── utils/             # Utilitários
│   ├── prisma/                # Schema e migrations
│   └── test-sheets-connection.js  # Teste de conexão
│
├── frontend/                   # Interface React
│   ├── src/
│   │   ├── components/        # Componentes React
│   │   ├── pages/             # Páginas
│   │   ├── services/          # Serviços de API
│   │   └── context/           # Contextos React
│   └── public/                # Arquivos estáticos
│
└── docs/                       # Documentação
    ├── INICIO_RAPIDO.md
    ├── README_EXPORTACAO_SHEETS.md
    └── ...
```

## 🚀 Instalação

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+
- npm ou yarn

### Backend
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔧 Configuração

### Backend (.env)
```env
# Banco de dados
DATABASE_URL="postgresql://..."

# JWT
JWT_SECRET="..."
JWT_EXPIRES_IN=12h

# Google Sheets (para exportação)
GOOGLE_CLIENT_EMAIL="..."
GOOGLE_PRIVATE_KEY="..."
SHEETS_PRESENCA_SPREADSHEET_ID="..."
SHEETS_PRESENCA_ABA="Controle_Presenca"

# Sincronização
SYNC_ENABLED=true
SYNC_INTERVAL_MINUTES=5
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000/api
```

## 📊 Scripts Disponíveis

### Backend
```bash
npm run dev              # Desenvolvimento
npm start                # Produção
npm run test:sheets      # Testar conexão Google Sheets
npm run prisma:studio    # Interface do banco
npm run prisma:migrate   # Executar migrations
```

### Frontend
```bash
npm run dev              # Desenvolvimento
npm run build            # Build para produção
npm run preview          # Preview do build
```

## 🔐 Autenticação

O sistema usa JWT para autenticação. Inclua o token no header:
```
Authorization: Bearer <token>
```

## 📡 API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro

### Colaboradores
- `GET /api/colaboradores` - Listar
- `POST /api/colaboradores` - Criar
- `PUT /api/colaboradores/:id` - Atualizar
- `DELETE /api/colaboradores/:id` - Deletar

### Controle de Presença
- `POST /api/ponto/registrar` - Registrar ponto
- `GET /api/ponto/controle` - Buscar controle
- `POST /api/ponto/ajuste-manual` - Ajuste manual
- `GET /api/ponto/exportar-sheets` - **NOVO:** Exportar para Sheets

### Dashboards
- `GET /api/dashboard/admin` - Dashboard admin
- `GET /api/dashboard/operacional` - Dashboard operacional
- `GET /api/dashboard/colaborador/:id` - Dashboard colaborador

## 🎯 Roadmap

### ✅ Concluído
- [x] Sistema de autenticação
- [x] Gestão de colaboradores
- [x] Controle de presença
- [x] Dashboards
- [x] Exportação para Google Sheets

### 🚧 Em Desenvolvimento
- [ ] Notificações push
- [ ] App mobile
- [ ] Relatórios avançados
- [ ] Integração com folha de pagamento

### 📋 Planejado
- [ ] BI integrado
- [ ] Machine Learning para previsões
- [ ] API pública
- [ ] Webhooks

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença ISC.

## 👥 Equipe

- **Backend:** Node.js + PostgreSQL
- **Frontend:** React + TailwindCSS
- **DevOps:** Render + Vercel

## 📞 Suporte

- **Documentação:** Veja pasta `/docs`
- **Issues:** Abra uma issue no GitHub
- **Email:** suporte@exemplo.com

## 🎉 Agradecimentos

Agradecimentos especiais a todos que contribuíram para este projeto.

---

**Versão:** 1.0.0  
**Última Atualização:** 06/02/2026  
**Status:** ✅ Em Produção
