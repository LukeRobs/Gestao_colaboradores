import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed TipoAusencia...");

  await prisma.tipoAusencia.createMany({
    skipDuplicates: true,
    data: [
      { codigo: "P", descricao: "Presença" },
      { codigo: "F", descricao: "Falta não justificada" },
      { codigo: "DSR", descricao: "Descanso Semanal Remunerado" },
      { codigo: "AM", descricao: "Atestado Médico" },
      { codigo: "FE", descricao: "Férias" },
      { codigo: "AFA", descricao: "Afastamento" },
      { codigo: "BH", descricao: "Banco de Horas" },
      { codigo: "S1", descricao: "Sinergia Enviada" },
      { codigo: "FO", descricao: "Folga" },
      { codigo: "LM", descricao: "Licença Maternidade" },
      { codigo: "LP", descricao: "Licença Paternidade" },
      { codigo: "AF", descricao: "Afastado" },
      { codigo: "AA", descricao: "Atestado de Acompanhamento" },
      { codigo: "T", descricao: "Transferido" },
      { codigo: "SU", descricao: "Suspensão" },
      { codigo: "AB", descricao: "Licença - Atestado de Óbito" },
      { codigo: "JE", descricao: "Licença - Justiça Eleitoral" },
    ],
  });

  console.log("✅ Seed TipoAusencia finalizado!");
}

main()
  .catch((e) => {
    console.error("❌ Erro ao rodar seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
