/**
 * Script: atualizar-motivos-automaticos.js
 *
 * Atualiza retroativamente o campo `motivo` de medidas disciplinares
 * geradas automaticamente pelo sistema (origem = "SISTEMA") que ainda
 * possuem o texto genérico antigo.
 *
 * Seguro: só toca registros com motivo exatamente igual ao texto antigo.
 *
 * Uso: node scripts/atualizar-motivos-automaticos.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const MOTIVO_ANTIGO = "Gerado automaticamente pelo sistema";

function buildMotivo({ tipoMedida, diasSuspensao, dataOcorrencia, isReincidencia }) {
  const dataFormatada = new Date(dataOcorrencia).toLocaleDateString("pt-BR", { timeZone: "UTC" });

  const ocorrenciaLabel = isReincidencia ? "reincidência" : "primeira ocorrência";

  const tipoMedidaLabel = {
    ADVERTENCIA: "advertência disciplinar",
    SUSPENSAO: `suspensão disciplinar de ${diasSuspensao || 1} dia(s)`,
    DEMISSAO: "demissão por justa causa",
  }[tipoMedida] || "medida disciplinar";

  const tipoCapitalizado = tipoMedidaLabel.charAt(0).toUpperCase() + tipoMedidaLabel.slice(1);

  return (
    `${tipoCapitalizado} aplicada em razão de falta injustificada detectada automaticamente pelo sistema no dia ${dataFormatada}. ` +
    `Trata-se de ${ocorrenciaLabel} registrada para esta violação. ` +
    `V.Sa. deixou de comparecer ao posto de trabalho sem apresentar qualquer justificativa válida, agindo assim com desídia no desempenho de suas funções.`
  );
}

async function main() {
  console.log("🔍 Buscando medidas com motivo genérico...\n");

  // Busca todas as medidas automáticas com motivo antigo, ordenadas por data
  const medidas = await prisma.medidaDisciplinar.findMany({
    where: {
      origem: "SISTEMA",
      motivo: MOTIVO_ANTIGO,
    },
    orderBy: [
      { opsId: "asc" },
      { violacao: "asc" },
      { dataOcorrencia: "asc" },
    ],
    select: {
      idMedida: true,
      opsId: true,
      violacao: true,
      tipoMedida: true,
      diasSuspensao: true,
      dataOcorrencia: true,
      colaborador: {
        select: { nomeCompleto: true },
      },
    },
  });

  if (medidas.length === 0) {
    console.log("✅ Nenhuma medida com motivo genérico encontrada. Nada a fazer.");
    return;
  }

  console.log(`📋 ${medidas.length} medida(s) encontrada(s) para atualizar.\n`);

  let atualizadas = 0;
  let erros = 0;

  for (const medida of medidas) {
    try {
      // Conta quantas medidas ANTERIORES existem para o mesmo colaborador/violação
      // para determinar se é 1ª ocorrência ou reincidência
      // Conta quantas medidas ANTERIORES existem para o mesmo colaborador/violação
      // para determinar se é 1ª ocorrência ou reincidência
      const result = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count
        FROM medida_disciplinar
        WHERE ops_id = ${medida.opsId}
          AND violacao = ${medida.violacao}
          AND data_ocorrencia < ${medida.dataOcorrencia}
          AND status::text NOT IN ('CANCELADA', 'CANCELADO')
      `;
      const anteriores = result[0]?.count ?? 0;

      const isReincidencia = anteriores > 0;

      const novoMotivo = buildMotivo({
        tipoMedida: medida.tipoMedida,
        diasSuspensao: medida.diasSuspensao,
        dataOcorrencia: medida.dataOcorrencia,
        isReincidencia,
      });

      await prisma.medidaDisciplinar.update({
        where: { idMedida: medida.idMedida },
        data: { motivo: novoMotivo },
      });

      const ocorrencia = isReincidencia ? "reincidência" : "1ª ocorrência";
      console.log(`  ✅ MD #${medida.idMedida} — ${medida.colaborador.nomeCompleto} (${ocorrencia})`);
      atualizadas++;

    } catch (err) {
      console.error(`  ❌ MD #${medida.idMedida} — erro:`, err.message);
      erros++;
    }
  }

  console.log(`\n📊 Resultado: ${atualizadas} atualizada(s), ${erros} erro(s).`);
}

main()
  .catch((err) => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
