/**
 * fix-historico-mismatch-escala.js
 *
 * Corrige colaboradores cujo registro aberto em ColaboradorEscalaHistorico
 * (dataFim = null) aponta para uma escala DIFERENTE da que está em
 * colaborador.idEscala — ou seja, o import atualizou a escala do colaborador
 * mas não criou/atualizou o histórico.
 *
 * Para cada colaborador afetado:
 *   1. Fecha o histórico aberto com dataFim = (hoje - 1 dia)
 *   2. Cria novo registro com idEscala = colaborador.idEscala e dataInicio = hoje
 *   3. Opcionalmente reconstrói os DSRs (via fix-dsr integrado)
 *
 * Uso:
 *   node scripts/fix-historico-mismatch-escala.js [--dry-run] [--estacao=N] [--reconstruir-dsr]
 */

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DRY_RUN        = process.argv.includes("--dry-run");
const RECONSTRUIR    = process.argv.includes("--reconstruir-dsr");
const ESTACAO_ARG    = process.argv.find((a) => a.startsWith("--estacao="));
const ESTACAO_ID     = ESTACAO_ARG ? Number(ESTACAO_ARG.split("=")[1]) : null;

function startOfDayUTC(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function isoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

async function getDiasDsrParaEscala(idEscala) {
  const escala = await prisma.escala.findUnique({
    where: { idEscala },
    select: { diasDsr: true, nomeEscala: true },
  });
  if (escala?.diasDsr?.length) return { diasDsr: escala.diasDsr, nomeEscala: escala.nomeEscala };
  const legado = { E: [0, 1], G: [2, 3], C: [4, 5] };
  const nome = (escala?.nomeEscala || "").toUpperCase();
  return { diasDsr: legado[nome] ?? [], nomeEscala: escala?.nomeEscala || "" };
}

async function main() {
  console.log(`\n🔧 fix-historico-mismatch-escala — modo: ${DRY_RUN ? "DRY RUN (sem alterações)" : "PRODUÇÃO"}\n`);

  /* 1. Busca colaboradores ativos da estação (fonte de verdade da escala atual) */
  const colaboradores = await prisma.colaborador.findMany({
    where: {
      status: { in: ["ATIVO", "FERIAS", "AFASTADO"] },
      ...(ESTACAO_ID && { idEstacao: ESTACAO_ID }),
    },
    select: { opsId: true, nomeCompleto: true, idEscala: true },
  });

  const colabMap = new Map(colaboradores.map((c) => [c.opsId, c]));
  const opsIdsFiltro = colaboradores.map((c) => c.opsId);
  console.log(`🏭 ${ESTACAO_ID ? `Estação ${ESTACAO_ID} — ` : ""}${opsIdsFiltro.length} colaboradores ativos encontrados\n`);

  /* 2. Busca histórico aberto apenas para esses opsIds */
  const historicosAbertos = await prisma.colaboradorEscalaHistorico.findMany({
    where: {
      dataFim: null,
      opsId: { in: opsIdsFiltro },
    },
    include: {
      escala: { select: { nomeEscala: true, idEscala: true } },
    },
  });

  /* 3. Filtra apenas os que têm mismatch (histórico aberto aponta escala diferente do colaborador) */
  const mismatches = historicosAbertos.filter((h) => {
    const c = colabMap.get(h.opsId);
    return c && c.idEscala !== null && c.idEscala !== h.idEscala;
  });

  if (!mismatches.length) {
    console.log("✅ Nenhum mismatch encontrado. Nada a fazer.");
    return;
  }

  console.log(`📋 ${mismatches.length} colaborador(es) com mismatch de escala:\n`);

  const hoje    = startOfDayUTC();
  const ontem   = addDays(hoje, -1);
  const futuro  = addDays(hoje, 90);

  let totalHistoricosCorrigidos = 0;
  let totalDsrDeletados         = 0;
  let totalDsrCriados           = 0;

  const tipoDSR = RECONSTRUIR
    ? await prisma.tipoAusencia.findFirst({ where: { codigo: "DSR" }, select: { idTipoAusencia: true } })
    : null;

  for (const h of mismatches) {
    const c = colabMap.get(h.opsId);
    const escalaAntigaNome = h.escala?.nomeEscala || `id=${h.idEscala}`;
    const escalaNova       = await prisma.escala.findUnique({
      where: { idEscala: c.idEscala },
      select: { nomeEscala: true },
    });
    const escalaNovaNoime  = escalaNova?.nomeEscala || `id=${c.idEscala}`;

    console.log(`👤 ${c.opsId} — ${c.nomeCompleto}`);
    console.log(`   Histórico aberto : id=${h.id} escala=${escalaAntigaNome}(${h.idEscala}) desde ${isoDate(h.dataInicio)}`);
    console.log(`   Escala atual (colab): ${escalaNovaNoime}(${c.idEscala})`);
    console.log(`   ✂️  Fechar histórico id=${h.id} com dataFim=${isoDate(ontem)}`);
    console.log(`   ➕ Criar novo histórico escala=${escalaNovaNoime} dataInicio=${isoDate(hoje)}`);

    if (!DRY_RUN) {
      /* Fecha o histórico antigo */
      await prisma.colaboradorEscalaHistorico.update({
        where: { id: h.id },
        data: { dataFim: ontem },
      });

      /* Cria novo com a escala correta — evita duplicar se já existir */
      const jaExiste = await prisma.colaboradorEscalaHistorico.findFirst({
        where: { opsId: c.opsId, idEscala: c.idEscala, dataInicio: hoje },
      });
      if (!jaExiste) {
        await prisma.colaboradorEscalaHistorico.create({
          data: { opsId: c.opsId, idEscala: c.idEscala, dataInicio: hoje },
        });
      }
    }
    totalHistoricosCorrigidos++;

    /* 3. (Opcional) Reconstrói DSRs */
    if (RECONSTRUIR && tipoDSR) {
      /* Busca TODOS os segmentos deste colaborador (incluindo o agora fechado) */
      const todosSegmentos = await prisma.colaboradorEscalaHistorico.findMany({
        where: { opsId: c.opsId },
        orderBy: { dataInicio: "asc" },
        select: { id: true, idEscala: true, dataInicio: true, dataFim: true },
      });

      /* Usa o início do primeiro segmento como ponto de partida */
      const dataInicioTotal = startOfDayUTC(todosSegmentos[0].dataInicio);

      const whereDelete = {
        opsId: c.opsId,
        idTipoAusencia: tipoDSR.idTipoAusencia,
        manual: false,
        justificativa: { in: ["DSR_AUTO", "DSR_BACKFILL"] },
        dataReferencia: { gte: dataInicioTotal, lte: futuro },
      };

      const existentes = await prisma.frequencia.findMany({
        where: whereDelete,
        select: { idFrequencia: true },
      });

      console.log(`   🗑️  ${existentes.length} DSRs a deletar`);

      if (!DRY_RUN && existentes.length > 0) {
        await prisma.frequencia.deleteMany({ where: whereDelete });
      }
      totalDsrDeletados += existentes.length;

      /* Reconstrói por segmento */
      let criados = 0;
      for (let i = 0; i < todosSegmentos.length; i++) {
        const seg    = todosSegmentos[i];
        const inicio = startOfDayUTC(seg.dataInicio);
        const fimSeg = seg.dataFim
          ? startOfDayUTC(seg.dataFim)
          : (i === todosSegmentos.length - 1 ? futuro : addDays(startOfDayUTC(todosSegmentos[i + 1].dataInicio), -1));

        const { diasDsr, nomeEscala } = await getDiasDsrParaEscala(seg.idEscala);
        console.log(`   📅 Segmento ${isoDate(inicio)} → ${isoDate(fimSeg)} | ${nomeEscala} | diasDsr=[${diasDsr.join(",")}]`);

        if (!diasDsr.length) continue;

        const registros = [];
        for (let d = new Date(inicio); d <= fimSeg; d = addDays(d, 1)) {
          if (!diasDsr.includes(d.getUTCDay())) continue;
          const justificativa = d <= hoje ? "DSR_BACKFILL" : "DSR_AUTO";
          registros.push({
            opsId: c.opsId,
            dataReferencia: new Date(d),
            idTipoAusencia: tipoDSR.idTipoAusencia,
            justificativa,
            manual: false,
            validado: true,
          });
        }

        console.log(`      ↳ ${registros.length} DSRs a criar`);
        criados += registros.length;

        if (!DRY_RUN && registros.length > 0) {
          await prisma.frequencia.createMany({ data: registros, skipDuplicates: true });
        }
      }

      totalDsrCriados += criados;
      console.log(`   ✅ DSRs: deletados=${existentes.length} recriados=${criados}`);
    }

    console.log();
  }

  console.log(`📊 Resumo:`);
  console.log(`   Colaboradores corrigidos  : ${totalHistoricosCorrigidos}`);
  if (RECONSTRUIR) {
    console.log(`   DSRs deletados            : ${totalDsrDeletados}`);
    console.log(`   DSRs recriados            : ${totalDsrCriados}`);
  }
  if (DRY_RUN) {
    console.log(`\n⚠️  Nenhuma alteração realizada (--dry-run). Remova a flag para aplicar.`);
  } else {
    console.log(`\n✅ Correção aplicada com sucesso.`);
  }
}

main()
  .catch((e) => { console.error("❌ Erro:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
