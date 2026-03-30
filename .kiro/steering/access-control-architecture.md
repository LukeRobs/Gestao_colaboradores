---
inclusion: manual
---

# Arquitetura de Controle de Acesso — Decisões e Contexto

## Contexto do Projeto

Sistema de gestão de pessoas (RH operacional) com backend Node.js/Express + Prisma e frontend React.
Atualmente opera em uma única filial (Matriz). Próxima expansão: filial em Santa Catarina.

---

## Roles Atuais

| Role | Descrição |
|---|---|
| ADMIN | Acesso total, sem restrição de escopo |
| GESTAO | Acesso gerencial (dashboards, treinamentos) |
| LIDERANCA | Acesso operacional de liderança |
| OPERACAO | Acesso muito restrito (ponto + 2 dashboards) |

> Existe também `MANAGER` em algumas rotas legadas — role não mais definida nos helpers, verificar se ainda existe no banco.

---

## Roles Futuras (novo modelo)

| Role | Escopo |
|---|---|
| ADMIN | Global — todas as filiais |
| REGIONAL | Região — subconjunto de filiais |
| GERENTE | Filial — uma ou mais filiais |
| GESTAO | Filial — filiais vinculadas |
| LIDERANCA | Filial — filiais vinculadas |
| OPERACAO | Filial — filiais vinculadas |

---

## Modelo Mental de Autorização

A autorização passa a ser definida por **2 dimensões**:

- **Role** → O QUE o usuário pode fazer
- **Escopo** → ONDE pode atuar (quais filiais)

---

## Decisão Arquitetural: Vínculos ao invés de filialId fixo

`filialId` fixo no usuário **não atende** porque:
- REGIONAL precisa acessar várias filiais
- GERENTE pode ser responsável por 2 ou mais filiais
- Evolução futura (gestor multi-filial)

### Estrutura Prisma

```prisma
model UserFilial {
  userId   String
  filialId String
  user     User   @relation(fields: [userId], references: [id])
  filial   Filial @relation(fields: [filialId], references: [id])
  @@id([userId, filialId])
}

model UserRegiao {
  userId   String
  regiaoId String
  user     User   @relation(fields: [userId], references: [id])
  regiao   Regiao @relation(fields: [regiaoId], references: [id])
  @@id([userId, regiaoId])
}

model Filial {
  id        String  @id
  nome      String
  regiaoId  String
  regiao    Regiao  @relation(fields: [regiaoId], references: [id])
  users     UserFilial[]
  colaboradores Colaborador[]
}

model Regiao {
  id      String  @id
  nome    String
  filiais Filial[]
  users   UserRegiao[]
}
```

---

## Resolução de Escopo (função central)

```js
// utils/resolveScope.js
function resolveFiliais(user) {
  if (user.role === 'ADMIN') return null; // null = sem filtro, acesso global

  if (user.role === 'REGIONAL') {
    // todas as filiais de todas as regiões vinculadas
    return user.regioes.flatMap(r => r.filiais.map(f => f.id));
  }

  // GERENTE, GESTAO, LIDERANCA, OPERACAO
  return user.filiais.map(f => f.id);
}
```

Toda query no backend passa a usar esse filtro:

```js
prisma.colaborador.findMany({
  where: { filialId: req.filialId ? { in: req.filialId } : undefined }
})
```

---

## Middleware de Escopo

```js
// middlewares/scopeFilial.js
module.exports = function scopeFilial(req, res, next) {
  if (req.user.role === 'ADMIN') return next();
  req.filialIds = resolveFiliais(req.user); // array de IDs permitidos
  next();
};
```

O escopo deve ser **estrutural e automático** — nunca depender do dev lembrar de aplicar em cada rota. Isso evita vazamento de dados entre filiais.

---

## Conceito de Contexto Ativo

Usuários com múltiplos vínculos (ADMIN, REGIONAL com várias regiões, GERENTE com 2 filiais) operam com **contexto ativo**:

- **Sem contexto selecionado** → visão macro (dados agregados de todas as filiais do escopo)
- **Com filial selecionada** → visão micro (dados daquela filial específica)

> O usuário **não muda de permissão**, muda de recorte de dados.

### Quem precisa do seletor de contexto no frontend

| Role | Precisa de seletor? |
|---|---|
| ADMIN | Sim — todas as filiais |
| REGIONAL | Sim — filiais da(s) região(ões) |
| GERENTE com 2+ filiais | Sim — filiais vinculadas |
| GERENTE com 1 filial | Não |
| LIDERANCA / GESTAO / OPERACAO | Não (sempre 1 filial) |

---

## Casos de Uso Confirmados

- **Gerente responsável por 2 filiais**: suportado via 2 registros em `UserFilial`
- **REGIONAL transitando entre regiões**: suportado via múltiplos registros em `UserRegiao` (vínculo fixo, não permissão temporária)

---

## Telas e Acessos Atuais (frontend)

### Dashboards
| Tela | Rota | Roles |
|---|---|---|
| Dashboard Operacional | `/dashboard/operacional` | ADMIN, LIDERANCA |
| Dashboard Admin | `/dashboard/admin` | ADMIN |
| Dashboard Colaboradores | `/dashboard/colaboradores` | ADMIN |
| Dashboard Atestados | `/dashboard/atestados` | ADMIN, LIDERANCA |
| Gestão Operacional | `/dashboard/gestao-operacional` | ADMIN, LIDERANCA |
| Produtividade Colaborador | `/dashboard/produtividade-colaborador` | ADMIN, LIDERANCA, OPERACAO |
| Dashboard Desligamento | `/dashboard/desligamento` | ADMIN |
| Dashboard Faltas | `/dashboard/faltas` | ADMIN, LIDERANCA |

### Colaboradores
| Tela | Rota | Roles |
|---|---|---|
| Listagem | `/colaboradores` | ADMIN, LIDERANCA |
| Novo | `/colaboradores/novo` | ADMIN |
| Importar CSV | `/colaboradores/import` | ADMIN |
| Editar | `/colaboradores/:opsId/editar` | ADMIN |
| Movimentar | `/colaboradores/:opsId/movimentar` | ADMIN |
| Perfil | `/colaboradores/:opsId` | ADMIN, LIDERANCA |

### RH
| Tela | Rota | Roles |
|---|---|---|
| Atestados | `/atestados` | ADMIN, LIDERANCA |
| Novo atestado | `/atestados/novo` | ADMIN, LIDERANCA |
| Medidas disciplinares | `/medidas-disciplinares` | ADMIN, LIDERANCA |
| Nova medida | `/medidas-disciplinares/novo` | ADMIN, LIDERANCA |
| Sugestões de medida | `/medidas-disciplinares/sugestao` | ⚠️ sem ProtectedRoute |
| Detalhe de medida | `/medidas-disciplinares/:id` | ⚠️ sem ProtectedRoute |
| Acidentes | `/acidentes` | ADMIN, LIDERANCA |
| Novo acidente | `/acidentes/novo` | ADMIN, LIDERANCA |

### Treinamentos
| Tela | Rota | Roles |
|---|---|---|
| Listagem | `/treinamentos` | ADMIN, LIDERANCA |
| Novo | `/treinamentos/novo` | ADMIN, LIDERANCA |
| Detalhes | `/treinamentos/:id` | ADMIN, LIDERANCA |

### Daily Works
| Tela | Rota | Roles |
|---|---|---|
| Lista DW | `/dw` | ADMIN, LIDERANCA |
| Novo DW | `/dw/novo` | ADMIN, LIDERANCA |

### Ponto
| Tela | Rota | Roles |
|---|---|---|
| Registrar ponto | `/ponto` | todos autenticados |
| Controle de presença | `/ponto/controle` | ADMIN, LIDERANCA |

### Estrutura / Configuração
| Tela | Rota | Roles |
|---|---|---|
| Empresas | `/empresas` | ADMIN |
| Setores | `/setores` | ADMIN |
| Cargos | `/cargos` | ADMIN |
| Regionais | `/regionais` | ADMIN |
| Estações | `/estacoes` | ADMIN |
| Folga dominical | `/folga-dominical` | ADMIN, LIDERANCA |

### Outros
| Tela | Rota | Roles |
|---|---|---|
| SPI (Seg. e Saúde) | `/spi` | ADMIN, LIDERANCA, GESTAO |
| Report | `/report` | ADMIN, LIDERANCA, GESTAO |

---

## Problemas Identificados no Código Atual

1. `/medidas-disciplinares/sugestao` e `/medidas-disciplinares/:id` sem `ProtectedRoute`
2. `GESTAO` aparece em apenas 2 telas (`/spi` e `/report`) — inconsistente com a role descrita
3. Role `MANAGER` ainda presente em algumas rotas de colaboradores — legada, verificar banco
4. Typo em `colaboradores.routes.js`: `authorize("ADMIN", "GESTAO", "LIDERAMCA")` — falta o N

---

## Plano de Migração Recomendado

### Fase 1 (implementar agora — expansão para SC)
- Criar models `Filial`, `Regiao`, `UserFilial`, `UserRegiao` no Prisma
- Migration populando filial atual como "Matriz"
- Middleware `scopeFilial` aplicado globalmente
- Atualizar `authenticate` para carregar vínculos do usuário
- Queries dos controllers passam a respeitar `req.filialIds`
- Frontend: seletor de contexto para ADMIN (e futuramente GERENTE multi-filial)

### Fase 2 (quando houver o caso de uso real)
- Role REGIONAL com vínculos de região
- Visão macro/micro para REGIONAL
- Dashboards comparativos entre filiais
