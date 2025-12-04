const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();


// ------------------------------------------
// FUNÇÃO DE DIA OPERACIONAL (06:00 → 05:59)
// ------------------------------------------
function getDataOperacionalRef(baseDate = new Date()) {
  const ref = new Date(baseDate.getTime() - 6 * 60 * 60 * 1000); // vira às 06h
  ref.setHours(0, 0, 0, 0); // zera horas
  return ref;
}



// ------------------------------------------
// CONTROLLER PRINCIPAL DO DASHBOARD
// ------------------------------------------
const carregarDashboard = async (req, res) => {
  try {
    console.log("📊 Carregando dashboard para usuário:", req.user?.name);

    // -----------------------------
    // DATA OPERACIONAL
    // -----------------------------
    const dataOperacional = getDataOperacionalRef(new Date());
    console.log("📅 Dashboard - Data Operacional:", dataOperacional);

    // -----------------------------
    // BUSCAS EM PARALELO
    // -----------------------------
    const [
      colaboradores,
      empresas,
      turnos,
      escalasAtivas,
      frequenciasHoje,
    ] = await Promise.all([
      prisma.colaborador.findMany({
        include: {
          empresa: true,
          turno: true,
        },
      }),

      prisma.empresa.findMany(),
      prisma.turno.findMany(),
      prisma.escala.findMany({ where: { ativo: true } }),

      // Frequência do dia operacional
      prisma.frequencia.findMany({
        where: { dataReferencia: dataOperacional },
        include: {
          colaborador: {
            include: { turno: true }
          },
          tipoAusencia: true,
        },
      }),
    ]);

    const mapFrequencia = new Map();
    for (const f of frequenciasHoje) {
      mapFrequencia.set(f.opsId, f);
    }

    // -----------------------------------
    // AUSENTES DO DIA OPERACIONAL
    // -----------------------------------
    const ausenciasFormatadas = [];

    colaboradores.forEach((c) => {
      const registro = mapFrequencia.get(c.opsId);

      if (!registro) {
        ausenciasFormatadas.push({
          colaboradorId: c.opsId,
          nome: c.nomeCompleto,
          turno: c.turno?.nomeTurno || "Sem turno",
          motivo: "Sem registro",
        });
        return;
      }

      if (registro.idTipoAusencia && !registro.horaEntrada) {
        ausenciasFormatadas.push({
          colaboradorId: c.opsId,
          nome: c.nomeCompleto,
          turno: c.turno?.nomeTurno || "Sem turno",
          motivo: registro.tipoAusencia?.descricao || "Ausência",
        });
      }
    });


    // -----------------------------------
    // RETORNO FINAL PARA O FRONT
    // -----------------------------------
    return res.json({
      success: true,
      data: {
        colaboradores: colaboradores.map(c => ({
          id: c.opsId,
          nome: c.nomeCompleto,
          status: c.status,
          genero: c.genero,
          empresa: c.empresa?.razaoSocial || "Sem Empresa",
          turno: c.turno?.nomeTurno || "Sem Turno",
        })),

        empresas: empresas.map(e => ({
          id: e.idEmpresa,
          nome: e.razaoSocial
        })),

        turnos: turnos.map(t => ({
          id: t.idTurno,
          nome: t.nomeTurno
        })),

        escalasAtivas: escalasAtivas.map(e => ({
          id: e.idEscala,
          nome: e.nomeEscala
        })),

        ausenciasHoje: ausenciasFormatadas,
        totalColaboradores: colaboradores.length,
        totalTurnos: turnos.length,
        totalEmpresas: empresas.length,
        totalEscalasAtivas: escalasAtivas.length,
      },
    });

  } catch (error) {
    console.error("❌ Erro ao carregar dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao carregar dashboard",
    });
  }
};


module.exports = {
  carregarDashboard,
};
