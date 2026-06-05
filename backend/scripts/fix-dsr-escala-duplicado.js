/**
 * fix-dsr-escala-duplicado.js
 *
 * Para colaboradores com histórico de escala duplicado (já corrigido pelo
 * fix-historico-escala-duplicado.js), os registros de DSR na tabela `frequencia`
 * ainda podem estar errados — o backfill anterior usou skipDuplicates e deixou
 * os DSRs da escala antiga intactos.
 *
 * Este script:
 *   1. Busca colaboradores com mais de 1 segmento de histórico de escala
 *   2. Para cada um, deleta todos os DSRs automáticos (manual=false, DSR_BACKFILL / DSR_AUTO)
 *      a partir da data de início do primeiro segmento de história afetado
 *   3. Regenera os DSRs corretos para cada período do histórico
 *
 * Uso:
 *   node scripts/fix-dsr-escala-duplicado.js [--dry-run]
 */

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DRY_RUN   = process.argv.includes("--dry-run")
const ESTACAO_ARG = process.argv.find((a) => a.startsWith("--estacao="))
const ESTACAO_ID  = ESTACAO_ARG ? Number(ESTACAO_ARG.split("=")[1]) : null

/* opsIds passados como argumentos extras, ex: node script.js Ops123 Ops456
   Se nenhum for passado e nenhuma estação informada, o script recusa executar. */
const OPS_IDS_ARG = process.argv.slice(2).filter((a) => !a.startsWith("--"));

function startOfDay(date) {
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
    select: { diasDsr: true, nomeEscala: true, idEstacao: true },
  });
  if (escala?.diasDsr?.length) return { diasDsr: escala.diasDsr, nomeEscala: escala.nomeEscala };

  // fallback legado
  const legado = { E: [0, 1], G: [2, 3], C: [4, 5] };
  const nome = (escala?.nomeEscala || "").toUpperCase();
  return { diasDsr: legado[nome] ?? [], nomeEscala: escala?.nomeEscala || "" };
}

async function main() {
  console.log(`\n🔧 fix-dsr-escala-duplicado — modo: ${DRY_RUN ? "DRY RUN (sem alterações)" : "PRODUÇÃO"}\n`);

  if (!OPS_IDS_ARG.length && !ESTACAO_ID) {
    console.error("❌ Informe os opsIds afetados OU uma estação com --estacao=N.");
    console.error("   Exemplos:");
    console.error("     node scripts/fix-dsr-escala-duplicado.js --estacao=1");
    console.error("     node scripts/fix-dsr-escala-duplicado.js Ops129324 Ops133848 ...");
    process.exit(1);
  }

  const tipoDSR = await prisma.tipoAusencia.findFirst({
    where: { codigo: "DSR" },
    select: { idTipoAusencia: true },
  });
  if (!tipoDSR) { console.error("❌ Tipo DSR não encontrado."); process.exit(1); }

  /* 1. Resolve a lista final de opsIds */
  let opsIdsFinal = OPS_IDS_ARG

  if (ESTACAO_ID && !OPS_IDS_ARG.length) {
    // Busca todos os colaboradores ativos da estação informada
    const colabs = await prisma.colaborador.findMany({
      where: {
        idEstacao: ESTACAO_ID,
        status: { in: ["ATIVO", "FERIAS", "AFASTADO"] },
      },
      select: { opsId: true },
    })
    opsIdsFinal = colabs.map((c) => c.opsId)
    console.log(`🏭 Estação ${ESTACAO_ID} — ${opsIdsFinal.length} colaboradores encontrados\n`)
  } else {
    console.log(`🎯 opsIds alvo: ${opsIdsFinal.join(", ")}\n`)
  }

  /* 2. Busca histórico apenas dos colaboradores alvo */
  const historicos = await prisma.colaboradorEscalaHistorico.findMany({
    where: { opsId: { in: opsIdsFinal } },
    orderBy: [{ opsId: "asc" }, { dataInicio: "asc" }],
    select: { id: true, opsId: true, idEscala: true, dataInicio: true, dataFim: true },
  });

  /* 3. Agrupa por colaborador */
  const porColaborador = {};
  for (const h of historicos) {
    if (!porColaborador[h.opsId]) porColaborador[h.opsId] = [];
    porColaborador[h.opsId].push(h);
  }

  const afetados = Object.entries(porColaborador);

  if (!afetados.length) {
    console.log("✅ Nenhum colaborador com múltiplos segmentos de escala encontrado. Nada a fazer.");
    return;
  }

  console.log(`📋 ${afetados.length} colaboradores com múltiplos segmentos de escala\n`);

  const hoje    = startOfDay(new Date());
  const futuroDias = 90;
  const futuro  = addDays(hoje, futuroDias);

  let totalDeletados = 0;
  let totalCriados   = 0;

  for (const [opsId, segmentos] of afetados) {
    console.log(`\n👤 ${opsId} — ${segmentos.length} segmentos`);

    /* Data inicial do intervalo a reconstruir (início do primeiro segmento histórico) */
    const dataInicioTotal = startOfDay(segmentos[0].dataInicio);

    /* 2. Deleta todos os DSRs automáticos do colaborador no intervalo */
    const whereDelete = {
      opsId,
      idTipoAusencia: tipoDSR.idTipoAusencia,
      manual: false,
      dataReferencia: {
        gte: dataInicioTotal,
        lte: futuro,
      },
    };

    const existentes = await prisma.frequencia.findMany({
      where: whereDelete,
      select: { idFrequencia: true, dataReferencia: true },
    });

    console.log(`   🗑️  ${existentes.length} DSRs a deletar (de ${isoDate(dataInicioTotal)} a ${isoDate(futuro)})`);

    if (!DRY_RUN && existentes.length > 0) {
      await prisma.frequencia.deleteMany({ where: whereDelete });
    }
    totalDeletados += existentes.length;

    /* 3. Reconstrói DSRs por segmento */
    let criados = 0;

    for (let i = 0; i < segmentos.length; i++) {
      const seg      = segmentos[i];
      const inicio   = startOfDay(seg.dataInicio);
      const fimSeg   = seg.dataFim
        ? startOfDay(seg.dataFim)
        : (i === segmentos.length - 1 ? futuro : addDays(startOfDay(segmentos[i + 1].dataInicio), -1));

      const { diasDsr, nomeEscala } = await getDiasDsrParaEscala(seg.idEscala);

      console.log(`   📅 Segmento ${isoDate(inicio)} → ${isoDate(fimSeg)} | escala ${nomeEscala} (id=${seg.idEscala}) | DSR dias: [${diasDsr.join(",")}]`);

      if (!diasDsr.length) continue;

      const registros = [];
      for (let d = new Date(inicio); d <= fimSeg; d = addDays(d, 1)) {
        if (!diasDsr.includes(d.getUTCDay())) continue;
        const justificativa = d <= hoje ? "DSR_BACKFILL" : "DSR_AUTO";
        registros.push({
          opsId,
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

    totalCriados += criados;
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   Colaboradores processados : ${afetados.length}`);
  console.log(`   DSRs deletados            : ${totalDeletados}`);
  console.log(`   DSRs recriados            : ${totalCriados}`);
  if (DRY_RUN) console.log(`\n⚠️  Nenhuma alteração realizada (--dry-run). Remova a flag para aplicar.`);
  else console.log(`\n✅ Correção aplicada com sucesso.`);
}

main()
  .catch((e) => { console.error("❌ Erro:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
