import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt"; // ADICIONE NO TOPO SE AINDA NÃO EXISTIR
const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Iniciando seed...");

  // ---------------------------------------------------------
  // 1. EMPRESAS — Criar caso não existam
  // ---------------------------------------------------------
  const empresaInfos = [
    { nome: "Adecco", cnpj: "11111111000111" },
    { nome: "Adillis", cnpj: "22222222000122" },
    { nome: "Shopee", cnpj: "33333333000133" },
  ];

  const empresas = [];

  for (const info of empresaInfos) {
    const empresa = await prisma.empresa.upsert({
      where: { razaoSocial: info.nome },
      update: {},
      create: {
        razaoSocial: info.nome,
        cnpj: info.cnpj,
        ativo: true,
      },
    });

    empresas.push(empresa);
  }

  console.log(
    "🏢 Empresas OK:",
    empresas.map((e) => `${e.idEmpresa} - ${e.razaoSocial}`)
  );

  // ---------------------------------------------------------
  // 2. TURNOS
  // ---------------------------------------------------------
  const turnoT1 = await prisma.turno.upsert({
    where: { nomeTurno: "T1" },
    update: {},
    create: {
      nomeTurno: "T1",
      horarioInicio: new Date("1970-01-01T06:00:00"),
      horarioFim: new Date("1970-01-01T14:00:00"),
    },
  });

  const turnoT2 = await prisma.turno.upsert({
    where: { nomeTurno: "T2" },
    update: {},
    create: {
      nomeTurno: "T2",
      horarioInicio: new Date("1970-01-01T14:00:00"),
      horarioFim: new Date("1970-01-01T23:00:00"),
    },
  });

  const turnoT3 = await prisma.turno.upsert({
    where: { nomeTurno: "T3" },
    update: {},
    create: {
      nomeTurno: "T3",
      horarioInicio: new Date("1970-01-01T23:00:00"),
      horarioFim: new Date("1970-01-02T06:00:00"),
    },
  });

  const turnos = [turnoT1, turnoT2, turnoT3];
  console.log("⏰ Turnos OK");

  // ---------------------------------------------------------
  // 3. ESCALAS
  // ---------------------------------------------------------
  const escalas = [
    await prisma.escala.upsert({
      where: { nomeEscala: "Escala Padrão" },
      update: {},
      create: {
        nomeEscala: "Escala Padrão",
        diasTrabalhados: 5,
        diasFolga: 2,
        ativo: true,
      },
    }),

    await prisma.escala.upsert({
      where: { nomeEscala: "Escala 6x1" },
      update: {},
      create: {
        nomeEscala: "Escala 6x1",
        diasTrabalhados: 6,
        diasFolga: 1,
        ativo: true,
      },
    }),

    await prisma.escala.upsert({
      where: { nomeEscala: "Escala 12x36" },
      update: {},
      create: {
        nomeEscala: "Escala 12x36",
        diasTrabalhados: 12,
        diasFolga: 36,
        ativo: true,
      },
    }),
  ];

  console.log("📅 Escalas OK");

  // ---------------------------------------------------------
  // 4. CARGOS
  // ---------------------------------------------------------
  const cargos = [
    await prisma.cargo.upsert({
      where: { nomeCargo: "Analista" },
      update: {},
      create: { nomeCargo: "Analista", nivel: "Junior" },
    }),

    await prisma.cargo.upsert({
      where: { nomeCargo: "Supervisor" },
      update: {},
      create: { nomeCargo: "Supervisor", nivel: "Senior" },
    }),

    await prisma.cargo.upsert({
      where: { nomeCargo: "Gerente" },
      update: {},
      create: { nomeCargo: "Gerente", nivel: "Pleno" },
    }),
  ];

  console.log("🧑‍💼 Cargos OK");

  // ---------------------------------------------------------
  // 5. ESTAÇÃO
  // ---------------------------------------------------------
  const estacaoUnica = await prisma.estacao.upsert({
    where: { nomeEstacao: "SoC_PE_Jabotao_dos_Guararapes" },
    update: {},
    create: { nomeEstacao: "SoC_PE_Jabotao_dos_Guararapes" },
  });

  console.log("📍 Estação OK");

  // ---------------------------------------------------------
  // 6. COLABORADOR BASE
  // ---------------------------------------------------------
  const colaboradoresBase = [
    {
      opsId: "OPS001",
      nomeCompleto: "Lucas Robson",
      genero: "Masculino",
      matricula: "M001",
      dataAdmissao: new Date("2023-01-01"),
      horarioInicioJornada: new Date("1970-01-01T06:00:00"),
      idEmpresa: empresas[0].idEmpresa, // Adecco
      idTurno: turnoT1.idTurno,
      idEscala: escalas[0].idEscala,
      idCargo: cargos[0].idCargo,
      idEstacao: estacaoUnica.idEstacao,
      status: "ATIVO",
    },
  ];

  for (const c of colaboradoresBase) {
    await prisma.colaborador.upsert({
      where: { opsId: c.opsId },
      update: {},
      create: c,
    });
  }

  console.log("👤 Colaboradores base OK");

  // ---------------------------------------------------------
  // 7. TIPO DE AUSÊNCIA PADRÃO
  // ---------------------------------------------------------
  const tipoPadrao = await prisma.tipoAusencia.upsert({
    where: { codigo: "GERAL" },
    update: {},
    create: {
      codigo: "GERAL",
      descricao: "Ausência geral",
      impactaAbsenteismo: true,
      justificada: false,
      requerDocumento: false,
    },
  });
// ---------------------------------------------------------
// 9. USUÁRIO ADMIN
// ---------------------------------------------------------

const admin = await prisma.user.upsert({
  where: { email: "admin@admin.com" },
  update: {},
  create: {
    name: "Admin",
    email: "admin@admin.com",
    password: await bcrypt.hash("123456", 10),
    role: "ADMIN",
    isActive: true,
  },
});

console.log("🛡️ Admin criado/validado:", admin.email);

  console.log("📌 Tipo ausência OK");

  // ---------------------------------------------------------
  // FINAL
  // ---------------------------------------------------------
  console.log("🎉 SEED FINALIZADO COM SUCESSO!");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
