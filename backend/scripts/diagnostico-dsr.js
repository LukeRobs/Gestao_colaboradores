/**
 * diagnostico-dsr.js
 *
 * Mostra o estado real do banco para diagnosticar por que o DSR
 * ainda aparece duplicado no front, mesmo após fix-historico e fix-dsr.
 *
 * Para cada colaborador informado exibe:
 *   1. Todos os registros em ColaboradorEscalaHistorico (ordenados por dataInicio)
 *   2. Todos os registros DSR em frequencia para o mês/ano informado
 *   3. Simulação dia-a-dia do que getDiasDsrNoDia retornaria (identifica quais
 *      dias o on-the-fly marcaria como DSR)
 *   4. Resultado final esperado (freqMap vs on-the-fly)
 *
 * Uso:
 *   node scripts/diagnostico-dsr.js --mes=2026-06 OpsId1 OpsId2 ...
 *   node scripts/diagnostico-dsr.js --mes=2026-06 --estacao=1
 */

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const MES_ARG   = process.argv.find((a) => a.startsWith("--mes="));
const MES       = MES_ARG ? MES_ARG.split("=")[1] : new Date().toISOString().slice(0, 7);
const ESTACAO_ARG = process.argv.find((a) => a.startsWith("--estacao="));
const ESTACAO_ID  = ESTACAO_ARG ? Number(ESTACAO_ARG.split("=")[1]) : null;
const OPS_IDS   = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const [anoStr, mesStr] = MES.split("-");
const ano    = Number(anoStr);
const mesNum = Number(mesStr);

const inicioMes = new Date(Date.UTC(ano, mesNum - 1, 1));
const fimMes    = new Date(Date.UTC(ano, mesNum, 0, 23, 59, 59, 999));

const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function ymd(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function getDiasDsrNoDia(opsId, dataUTC, historicoMap, diasDsrAtual) {
  const registros = historicoMap[opsId];
  if (!registros || registros.length === 0) return { dias: diasDsrAtual, fonte: "fallback-sem-historico" };

  const d = new Date(dataUTC);
  const registro = registros.find((r) => {
    const inicio = new Date(r.dataInicio);
    const fim    = r.dataFim ? new Date(r.dataFim) : null;
    return d >= inicio && (!fim || d <= fim);
  });

  if (!registro) {
    return { dias: diasDsrAtual, fonte: `fallback-sem-match(${registros.length} registros)` };
  }
  return {
    dias:   registro.escala?.diasDsr || diasDsrAtual,
    fonte:  `historico-id=${registro.id} escala=${registro.escala?.nomeEscala}(${registro.idEscala})`,
  };
}

async function main() {
  console.log(`\n🔍 DIAGNÓSTICO DSR — ${MES}\n`);

  if (!OPS_IDS.length && !ESTACAO_ID) {
    console.error("❌ Informe opsIds como argumento OU --estacao=N");
    process.exit(1);
  }

  let opsIdsFinal = OPS_IDS;
  if (ESTACAO_ID && !OPS_IDS.length) {
    const colabs = await prisma.colaborador.findMany({
      where: { idEstacao: ESTACAO_ID, status: { in: ["ATIVO","FERIAS","AFASTADO"] } },
      select: { opsId: true },
    });
    opsIdsFinal = colabs.map((c) => c.opsId);
    console.log(`🏭 Estação ${ESTACAO_ID} — ${opsIdsFinal.length} colaboradores\n`);
  }

  // Busca dados
  const colaboradores = await prisma.colaborador.findMany({
    where: { opsId: { in: opsIdsFinal } },
    include: { escala: true },
  });

  const historicos = await prisma.colaboradorEscalaHistorico.findMany({
    where: { opsId: { in: opsIdsFinal } },
    include: { escala: { select: { nomeEscala: true, diasDsr: true } } },
    orderBy: [{ opsId: "asc" }, { dataInicio: "asc" }],
  });

  const tipoDSR = await prisma.tipoAusencia.findFirst({
    where: { codigo: "DSR" },
    select: { idTipoAusencia: true },
  });
  console.log(`ℹ️  tipoDSR.idTipoAusencia = ${tipoDSR?.idTipoAusencia}\n`);

  const frequencias = await prisma.frequencia.findMany({
    where: {
      opsId:          { in: opsIdsFinal },
      idTipoAusencia: tipoDSR?.idTipoAusencia,
      dataReferencia: { gte: inicioMes, lte: fimMes },
    },
    orderBy: [{ opsId: "asc" }, { dataReferencia: "asc" }],
  });

  // Monta historicoMap
  const historicoMap = {};
  for (const h of historicos) {
    if (!historicoMap[h.opsId]) historicoMap[h.opsId] = [];
    historicoMap[h.opsId].push(h);
  }

  // Monta freqMap (apenas DSRs do mês)
  const freqDsrMap = {};
  for (const f of frequencias) {
    const k = `${f.opsId}_${ymd(f.dataReferencia)}`;
    if (!freqDsrMap[k]) freqDsrMap[k] = [];
    freqDsrMap[k].push(f);
  }

  const totalDias = new Date(ano, mesNum, 0).getDate();

  for (const c of colaboradores) {
    const escalaAtual = c.escala;
    console.log(`${"─".repeat(80)}`);
    console.log(`👤 ${c.opsId} — ${c.nomeCompleto}`);
    console.log(`   Escala ATUAL no colaborador: ${escalaAtual?.nomeEscala || "N/A"} (id=${c.idEscala}) | diasDsr=[${escalaAtual?.diasDsr?.join(",") ?? ""}]`);
    console.log();

    // 1. Histórico de escalas
    const hist = historicoMap[c.opsId] || [];
    console.log(`   📋 Histórico ColaboradorEscalaHistorico (${hist.length} registro(s)):`);
    for (const h of hist) {
      const fim = h.dataFim ? ymd(h.dataFim) : "ABERTO";
      console.log(`      id=${h.id} | escala=${h.escala?.nomeEscala || "?"} (id=${h.idEscala}) | ${ymd(h.dataInicio)} → ${fim} | diasDsr=[${h.escala?.diasDsr?.join(",") ?? ""}]`);
    }
    console.log();

    // 2. Registros DSR no freqMap
    const dsrDoMes = frequencias.filter((f) => f.opsId === c.opsId);
    console.log(`   🗂️  DSRs em frequencia para ${MES} (${dsrDoMes.length} registro(s)):`);
    for (const f of dsrDoMes) {
      console.log(`      id=${f.idFrequencia} | ${ymd(f.dataReferencia)} (${DIAS_SEMANA[new Date(f.dataReferencia).getUTCDay()]}) | manual=${f.manual} | justificativa=${f.justificativa}`);
    }
    console.log();

    // 3. Simulação dia-a-dia
    console.log(`   📅 Simulação dia-a-dia:`);
    console.log(`      Data       DiaSem  freqMap?  getDiaDSR-fonte                            diaDSR  Resultado`);
    console.log(`      ${"─".repeat(95)}`);

    let problemas = 0;

    for (let d = 1; d <= totalDias; d++) {
      const dt  = new Date(Date.UTC(ano, mesNum - 1, d));
      const iso = ymd(dt);
      const key = `${c.opsId}_${iso}`;

      const { dias: diasDsr, fonte } = getDiasDsrNoDia(c.opsId, dt, historicoMap, escalaAtual?.diasDsr || []);
      const diaDSR = diasDsr.includes(dt.getUTCDay());

      const freqEntries = freqDsrMap[key];
      let resultado;
      if (freqEntries?.length) {
        resultado = `DSR(tabela, ${freqEntries.length} reg, manual=${freqEntries.map((f) => f.manual).join("/")})`;
      } else if (diaDSR) {
        resultado = "DSR(on-the-fly)";
      } else {
        resultado = "-";
      }

      // Detecta problema: dia mostra DSR mas não deveria (ou mostra 2x)
      const diasEsperados = escalaAtual?.diasDsr || [];
      const esperaDSR = diasEsperados.includes(dt.getUTCDay());
      const mostraDSR = resultado.startsWith("DSR");
      const problema = mostraDSR !== esperaDSR;

      if (problema) problemas++;

      const flag = problema ? " ⚠️ PROBLEMA" : "";
      const diaSemana = DIAS_SEMANA[dt.getUTCDay()];

      // Só imprime dias DSR ou problemáticos para não encher o log
      if (mostraDSR || problema) {
        console.log(`      ${iso}  ${diaSemana.padEnd(4)}   ${freqEntries ? `SIM(${freqEntries.length})  ` : "NÃO      "} ${fonte.padEnd(40)} ${diaDSR ? "SIM" : "NÃO"}    ${resultado}${flag}`);
      }
    }

    if (problemas === 0) {
      console.log(`      ✅ Nenhum problema detectado`);
    } else {
      console.log(`\n      ❌ ${problemas} dia(s) com DSR incorreto`);
    }

    console.log();
  }

  // Resumo de possíveis causas
  console.log(`\n${"═".repeat(80)}`);
  console.log(`📊 LEGENDA DE PROBLEMAS:`);
  console.log(`  ⚠️ DSR(tabela)   → registro em frequencia que não deveria existir (delete falhou)`);
  console.log(`  ⚠️ DSR(on-the-fly) → historicoMap retornando escala errada (ou fallback incorreto)`);
  console.log(`  ⚠️ "-" onde deveria ser DSR → DSR faltando na tabela e getDiasDsrNoDia não detectou`);
}

main()
  .catch((e) => { console.error("❌ Erro:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
