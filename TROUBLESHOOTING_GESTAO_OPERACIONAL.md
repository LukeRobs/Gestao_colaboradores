# Troubleshooting - Dashboard Gestão Operacional

## Erro 500 - Passos para Diagnóstico

### 1. Verificar Logs do Backend

Abra o terminal onde o backend está rodando e procure por mensagens de erro. Os logs devem mostrar:

```
📊 Requisição recebida: { data: '2026-03-04', turno: 'T1' }
📅 Data processada: 2026-03-04
🔍 Buscando metas da planilha...
```

### 2. Testar Endpoint de Teste

Acesse no navegador ou Postman:
```
http://localhost:3000/api/dashboard/gestao-operacional/test?turno=T1&data=2026-03-04
```

Isso vai testar apenas a conexão com o Google Sheets.

### 3. Verificar Credenciais do Google

No arquivo `.env` do backend, verifique se existem:

```env
GOOGLE_CLIENT_EMAIL=seu-email@projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Importante:** A chave privada deve ter `\n` literais, não quebras de linha reais.

### 4. Verificar Permissões da Planilha

1. Abra a planilha: https://docs.google.com/spreadsheets/d/17Dpmr1Kn6ybvK3rah2JvoCBsAeOvotvM6k_7uaATPz0/edit
2. Clique em "Compartilhar"
3. Adicione o email da conta de serviço (GOOGLE_CLIENT_EMAIL) com permissão de "Visualizador"

### 5. Verificar Estrutura da Planilha

A aba "Meta" deve ter as colunas nesta ordem:

| Coluna A | Coluna B | Coluna C | Coluna D | Coluna E |
|----------|----------|----------|----------|----------|
| Data     | Hora     | Esteira  | Meta     | Turno    |

Exemplo de dados:
```
04/03/2026 | 6 | Esteira A (Esquerda) | 2,125 | T1
04/03/2026 | 6 | Esteira B (Direita)  | 0     | T1
```

**Importante:** 
- Data no formato DD/MM/YYYY
- Hora como número (6, 7, 8, etc.)
- Meta pode ter vírgula ou ponto decimal
- Turno exatamente como "T1", "T2" ou "T3"

### 6. Verificar Tabela DwReal no Banco

Execute no banco de dados:

```sql
SELECT * FROM "DwReal" 
WHERE DATE("dataReferencia") = '2026-03-04' 
AND "idTurno" = 1
LIMIT 5;
```

Isso verifica se há dados de produção para comparar com as metas.

### 7. Erros Comuns

#### Erro: "Aba Meta vazia"
- A planilha não tem a aba "Meta" ou está vazia
- Verifique o nome da aba (case-sensitive)

#### Erro: "Cannot read property 'values' of undefined"
- Credenciais do Google inválidas
- Planilha não compartilhada com a conta de serviço

#### Erro: "Nenhuma linha encontrada"
- Formato da data incorreto na planilha
- Turno escrito diferente (ex: "t1" em vez de "T1")
- Data não existe na planilha

#### Erro: "idTurno is not defined"
- Problema na query SQL
- Verificar se a tabela DwReal existe

### 8. Teste Manual da API

Use o Postman ou curl:

```bash
curl -X GET "http://localhost:3000/api/dashboard/gestao-operacional?turno=T1&data=2026-03-04" \
  -H "Authorization: Bearer SEU_TOKEN"
```

### 9. Verificar Rota Registrada

No arquivo `backend/src/routes/index.js`, deve ter:

```javascript
const gestaoOperacionalRoutes = require("./gestaoOperacional.routes");
// ...
router.use("/dashboard/gestao-operacional", gestaoOperacionalRoutes);
```

### 10. Reiniciar Servidor

Às vezes, mudanças em arquivos de serviço requerem reinicialização:

```bash
# Parar o servidor (Ctrl+C)
# Iniciar novamente
npm run dev
```

## Logs Esperados (Sucesso)

```
📊 Requisição recebida: { data: '2026-03-04', turno: 'T1' }
📅 Data processada: 2026-03-04
🔍 Buscando metas da planilha...
🔍 Iniciando busca de metas: { turno: 'T1', dataISO: '2026-03-04' }
📦 Meta retornada do cache (ou 🌎 Buscando Meta no Google Sheets...)
📋 Planilha carregada: 150 linhas
🔍 Buscando metas para: { turno: 'T1', data: '04/03/2026' }
✅ Match encontrado: { hora: 6, esteira: 'Esteira A (Esquerda)', meta: 2.125, total: 2.125 }
✅ Metas encontradas: { metaDia: 26800, horas: 8, linhasEncontradas: 32 }
✅ Metas carregadas: { metaDia: 26800, horasComMeta: 8 }
🔍 Buscando produção do banco...
✅ Produção carregada: 5 registros
✅ Resposta preparada com sucesso
```

## Contato

Se o erro persistir, envie:
1. Logs completos do backend
2. Screenshot do erro no frontend
3. Resposta do endpoint de teste
4. Primeiras 5 linhas da aba "Meta" da planilha
