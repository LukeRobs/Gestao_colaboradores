import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed expandido...");

  // ----------------- EMPRESAS (BUSCANDO AS 3 EXISTENTES, SEM CRIAR NOVAS) -----------------
  const empresa1 = await prisma.empresa.findFirst({ where: { razaoSocial: "Adecco" } });
  if (!empresa1) {
    console.warn("⚠️ Empresa Adecco não encontrada. Pulando distribuição para ela.");
    return;
  }

  const empresa2 = await prisma.empresa.findFirst({ where: { razaoSocial: "Adillis" } });
  if (!empresa2) {
    console.warn("⚠️ Empresa Adillis não encontrada. Pulando distribuição para ela.");
    return;
  }

  const empresa3 = await prisma.empresa.findFirst({ where: { razaoSocial: "Shopee" } });
  if (!empresa3) {
    console.warn("⚠️ Empresa Shopee não encontrada. Pulando distribuição para ela.");
    return;
  }

  const empresas = [empresa1, empresa2, empresa3];
  console.log("✅ Empresas encontradas:", empresas.map(e => `${e.idEmpresa}: ${e.razaoSocial}`));

  // ----------------- TURNOS (UPSERT PARA GARANTIR) -----------------
  const turnoT1 = await prisma.turno.upsert({
    where: { nomeTurno: "T1" },
    update: {},
    create: { nomeTurno: "T1", horarioInicio: new Date("1970-01-01T06:00:00"), horarioFim: new Date("1970-01-01T14:00:00") },
  });
  const turnoT2 = await prisma.turno.upsert({
    where: { nomeTurno: "T2" },
    update: {},
    create: { nomeTurno: "T2", horarioInicio: new Date("1970-01-01T14:00:00"), horarioFim: new Date("1970-01-01T23:00:00") },
  });
  const turnoT3 = await prisma.turno.upsert({
    where: { nomeTurno: "T3" },
    update: {},
    create: { nomeTurno: "T3", horarioInicio: new Date("1970-01-01T23:00:00"), horarioFim: new Date("1970-01-02T06:00:00") },
  });

  const turnos = [turnoT1, turnoT2, turnoT3];

  // ----------------- ESCALAS (UPSERT PARA GARANTIR) -----------------
  const escala1 = await prisma.escala.upsert({
    where: { nomeEscala: "Escala Padrão" },
    update: {},
    create: { nomeEscala: "Escala Padrão", diasTrabalhados: 5, diasFolga: 2, ativo: true },
  });

  const escala2 = await prisma.escala.upsert({
    where: { nomeEscala: "Escala 6x1" },
    update: {},
    create: { nomeEscala: "Escala 6x1", diasTrabalhados: 6, diasFolga: 1, ativo: true },
  });

  const escala3 = await prisma.escala.upsert({
    where: { nomeEscala: "Escala 12x36" },
    update: {},
    create: { nomeEscala: "Escala 12x36", diasTrabalhados: 12, diasFolga: 36, ativo: true },
  });

  const escalas = [escala1, escala2, escala3];

  // ----------------- CARGOS (UPSERT PARA GARANTIR) -----------------
  const cargo1 = await prisma.cargo.upsert({
    where: { nomeCargo: "Analista" },
    update: {},
    create: { nomeCargo: "Analista", nivel: "Junior" },
  });

  const cargo2 = await prisma.cargo.upsert({
    where: { nomeCargo: "Supervisor" },
    update: {},
    create: { nomeCargo: "Supervisor", nivel: "Senior" },
  });

  const cargo3 = await prisma.cargo.upsert({
    where: { nomeCargo: "Gerente" },
    update: {},
    create: { nomeCargo: "Gerente", nivel: "Pleno" },
  });

  const cargos = [cargo1, cargo2, cargo3];

  // ----------------- ESTAÇÕES (SÓ A EXISTENTE) -----------------
  const estacaoUnica = await prisma.estacao.findFirst({ where: { nomeEstacao: "SoC_PE_Jabotao_dos_Guararapes" } });
  if (!estacaoUnica) {
    console.warn("⚠️ Estação 'SoC_PE_Jabotao_dos_Guararapes' não encontrada.");
    return;
  }

  const estacoes = [estacaoUnica];

  // ----------------- COLABORADORES ORIGINAIS (UPSERT PARA GARANTIR, AJUSTADOS PARA AS EMPRESAS REAIS) -----------------
  const colaboradoresOriginais = [
    {
      opsId: "OPS001",
      nomeCompleto: "Lucas Robson",
      genero: "Masculino",
      matricula: "M001",
      dataAdmissao: new Date("2023-01-01"),
      horarioInicioJornada: new Date("1970-01-01T06:00:00"),
      idEmpresa: empresa1.idEmpresa, // Adecco (ID 4)
      idTurno: turnoT1.idTurno,
      idEscala: escala1.idEscala,
      idCargo: cargo1.idCargo,
      idEstacao: estacaoUnica.idEstacao,
      status: "ATIVO",
    },
    {
      opsId: "OPS002",
      nomeCompleto: "Ana Souza",
      genero: "Feminino",
      matricula: "M002",
      dataAdmissao: new Date("2023-02-15"),
      horarioInicioJornada: new Date("1970-01-01T14:00:00"),
      idEmpresa: empresa1.idEmpresa, // Adecco (ID 4)
      idTurno: turnoT2.idTurno,
      idEscala: escala1.idEscala,
      idCargo: cargo1.idCargo,
      idEstacao: estacaoUnica.idEstacao,
      status: "ATIVO",
    },
    {
      opsId: "OPS003",
      nomeCompleto: "Carlos Lima",
      genero: "Masculino",
      matricula: "M003",
      dataAdmissao: new Date("2023-03-10"),
      horarioInicioJornada: new Date("1970-01-01T23:00:00"),
      idEmpresa: empresa2.idEmpresa, // Adillis (ID 3)
      idTurno: turnoT3.idTurno,
      idEscala: escala1.idEscala,
      idCargo: cargo2.idCargo,
      idEstacao: estacaoUnica.idEstacao,
      status: "ATIVO",
    },
  ];

  for (const c of colaboradoresOriginais) {
    await prisma.colaborador.upsert({
      where: { opsId: c.opsId },
      update: {},
      create: c,
    });
  }

  // ----------------- GERANDO 107 NOVOS COLABORADORES (DISTRIBUÍDOS NAS 3 EMPRESAS EXISTENTES) -----------------
  // Listas para gerar nomes variados (nomes comuns brasileiros)
  const nomesMasculinos = ["João", "Pedro", "Lucas", "Mateus", "Gabriel", "Rafael", "Diego", "Felipe", "André", "Bruno", "Carlos", "Daniel", "Eduardo", "Fernando", "Gustavo", "Henrique", "Igor", "José", "Kevin", "Leonardo"];
  const nomesFemininos = ["Maria", "Ana", "Julia", "Camila", "Fernanda", "Larissa", "Mariana", "Natália", "Olivia", "Paula", "Quitéria", "Rita", "Sofia", "Tatiana", "Ursula", "Vanessa", "Wanda", "Ximena", "Yara", "Zilda"];
  const sobrenomes = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Moreira", "Machado", "Marques", "Nunes"];

  function gerarNome(genero) {
    const nomeLista = genero === "Masculino" ? nomesMasculinos : nomesFemininos;
    const nome = nomeLista[Math.floor(Math.random() * nomeLista.length)];
    const sobrenome = sobrenomes[Math.floor(Math.random() * sobrenomes.length)];
    return `${nome} ${sobrenome}`;
  }

  function dataAleatoriaAdmissao() {
    const ano = 2023 + Math.floor(Math.random() * 2); // 2023-2024
    const mes = 1 + Math.floor(Math.random() * 12);
    const dia = 1 + Math.floor(Math.random() * 28);
    return new Date(ano, mes - 1, dia);
  }

  function horarioAleatorioPorTurno(turnoIndex) {
    const horarios = [
      new Date("1970-01-01T06:00:00"), // T1
      new Date("1970-01-01T14:00:00"), // T2
      new Date("1970-01-01T23:00:00"), // T3
    ];
    return horarios[turnoIndex];
  }

  // Distribuição balanceada: ~36 por empresa (3 empresas), ~37 por turno, ~37 por escala
  const novosColaboradores = [];
  for (let i = 0; i < 107; i++) {
    const opsId = `OPS${String(4 + i).padStart(3, '0')}`; // OPS004 a OPS110
    const matricula = `M${String(4 + i).padStart(3, '0')}`;
    const genero = Math.random() > 0.5 ? "Masculino" : "Feminino";
    const nomeCompleto = gerarNome(genero);
    const dataAdmissao = dataAleatoriaAdmissao();
    const idxEmpresa = Math.floor(i / 36) % 3; // ~36 por empresa
    const idxTurno = Math.floor(i / 37) % 3; // ~37 por turno
    const idxEscala = Math.floor(i / 37) % 3; // ~37 por escala
    const idxCargo = Math.floor(Math.random() * cargos.length);
    const idxEstacao = 0; // Sempre a única estação

    novosColaboradores.push({
      opsId,
      nomeCompleto,
      genero,
      matricula,
      dataAdmissao,
      horarioInicioJornada: horarioAleatorioPorTurno(idxTurno),
      idEmpresa: empresas[idxEmpresa].idEmpresa,
      idTurno: turnos[idxTurno].idTurno,
      idEscala: escalas[idxEscala].idEscala,
      idCargo: cargos[idxCargo].idCargo,
      idEstacao: estacoes[idxEstacao].idEstacao,
      status: "ATIVO",
    });
  }

  for (const c of novosColaboradores) {
    await prisma.colaborador.upsert({
      where: { opsId: c.opsId },
      update: {},
      create: c,
    });
  }

  console.log(`✅ Adicionados ${novosColaboradores.length} novos colaboradores nas 3 empresas existentes. Total: ~110.`);

  // ----------------- CRIANDO TIPO AUSÊNCIA PADRÃO (USANDO CODIGO COMO UNIQUE) -----------------
  const tipoAusenciaPadrao = await prisma.tipoAusencia.upsert({
    where: { codigo: "GERAL" }, // ← CORRIGIDO: Use codigo como unique
    update: {},
    create: { 
      codigo: "GERAL",
      descricao: "Ausência geral para testes",
      impactaAbsenteismo: true,
      justificada: true,
      requerDocumento: false,
    },
  });

  // ----------------- ADICIONANDO AUSÊNCIAS VARIADAS PARA TESTAR ABSENTEÍSMO (~15% ausentes hoje, com datas variadas) -----------------
  // Data de hoje: 2025-11-27, mas variando para ausências em datas próximas para mais variedade
  const dataBase = new Date("2025-11-27T00:00:00.000Z");
  const todosColaboradores = await prisma.colaborador.findMany({ select: { opsId: true } }); // Pega opsId
  const numAusentes = Math.floor(todosColaboradores.length * 0.15); // ~16 ausentes

  const motivosVariados = [
    "Férias", "Doença Gripal", "Atestado Médico", "Licença Maternidade", "Motivo Pessoal",
    "Dentista", "Exame Médico", "Curso Externo", "Falecimento Familiar", "Viagem",
    "Problema Familiar", "Atraso no Transporte", "Queda de Energia", "Conflito de Escala", "Outros"
  ];

  for (let i = 0; i < numAusentes; i++) {
    const colaboradorAleatorio = todosColaboradores[Math.floor(Math.random() * todosColaboradores.length)];
    const motivoAleatorio = motivosVariados[Math.floor(Math.random() * motivosVariados.length)];

    // Variar datas: hoje, ontem ou amanhã, para simular ausências recentes/atuais
    const diasVariacao = [-1, 0, 1];
    const diaEscolhido = diasVariacao[Math.floor(Math.random() * diasVariacao.length)];
    const dataInicio = new Date(dataBase.getTime() + (diaEscolhido * 24 * 60 * 60 * 1000));
    const dataFim = new Date(dataInicio.getTime() + 24 * 60 * 60 * 1000 - 1); // Até fim do dia

    // Calcular dias corridos simples (1 para ausências de 1 dia)
    const diasCorridos = 1;

    // CORRIGIDO: Use FKs diretos (opsId e idTipoAusencia) sem nested relations
    await prisma.ausencia.create({
      data: {
        // Não especifique idAusencia – deixa auto-gerar
        opsId: colaboradorAleatorio.opsId, // ← FK para colaborador
        idTipoAusencia: tipoAusenciaPadrao.idTipoAusencia, // ← FK para tipoAusencia
        dataInicio,
        dataFim,
        motivo: motivoAleatorio,
        status: "ATIVO", // ← Enum correto do schema
        diasCorridos, // Opcional, mas útil para testes
        // Outros opcionais: null por default
      },
    });
  }

  console.log(`✅ Adicionadas ${numAusentes} ausências variadas (datas e motivos diferentes) para período ao redor de hoje (2025-11-27). Taxa de absenteísmo ~15%.`);

  console.log("Seed expandido finalizado!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });