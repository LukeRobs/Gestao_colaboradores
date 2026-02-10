export function buildOperationalReportData({ dados, turno, periodo }) {
  if (!dados || !dados.distribuicaoTurnoSetor) {
    console.error("Payload recebido no report:", dados)
    throw new Error("buildOperationalReportData: payload inválido")
  }

  /* ================= HELPERS ================= */
  const safe = (v) => Number(v || 0)

  const turnoKey = String(turno || "").trim().toUpperCase()

  const normalizePie = (arr, nameKey, valueKey) =>
    (arr || []).map((i) => ({
      name: i?.[nameKey] ?? "N/I",
      value: safe(i?.[valueKey]),
    }))

  /* ================= BASE DO TURNO (FONTE ÚNICA) ================= */
  const turnoData =
    dados.distribuicaoTurnoSetor?.find((t) => t.turno === turnoKey) || {}

  const colaboradoresPlanejados = safe(turnoData.totalEscalados)
  const colaboradoresPresentes = safe(turnoData.presentes)
  const ausencias = safe(turnoData.ausentes)

  const diaristasPlanejados = safe(turnoData.diaristasPlanejados)
  const diaristasPresentes = safe(turnoData.diaristasPresentes)

  const totalPlanejado = colaboradoresPlanejados + diaristasPlanejados
  const totalReal = colaboradoresPresentes + diaristasPresentes

  const aderenciaDW =
    diaristasPlanejados > 0
      ? Math.round((diaristasPresentes / diaristasPlanejados) * 100)
      : 0

  const aderenciaTotal =
    totalPlanejado > 0
      ? Math.round((totalReal / totalPlanejado) * 100)
      : 0

  const absenteismo =
    colaboradoresPlanejados > 0
      ? Number(((ausencias / colaboradoresPlanejados) * 100).toFixed(2))
      : 0

  /* ================= PERÍODO ================= */
  const periodoLabel =
    periodo?.from
      ? periodo.to
        ? `${periodo.from.toLocaleDateString("pt-BR")} → ${periodo.to.toLocaleDateString("pt-BR")}`
        : periodo.from.toLocaleDateString("pt-BR")
      : `${dados.periodo?.inicio || ""} → ${dados.periodo?.fim || ""}`

  /* ================= SETORES ================= */
  const setores =
    turnoData.setores?.map((s) => ({
      name: s.setor,
      value: safe(s.quantidade),
    })) || []

  /* ================= EMPRESAS ================= */
  const empresas =
    (dados.empresaPorTurno?.[turnoKey] || []).map((e) => ({
      name: e.empresa,
      total: safe(e.total),
      absenteismo: safe(e.absenteismo),
      atestados: safe(e.atestados),
    }))

  /* ================= AUSÊNCIAS ================= */
  const ausenciasHoje =
    (dados.ausenciasHoje || []).filter((a) => a.turno === turnoKey)

  const atestados = ausenciasHoje.filter(
    (a) => a.motivo === "Atestado Médico"
  ).length

  const faltas = ausenciasHoje.filter(
    (a) => a.motivo === "Falta"
  ).length

  /* ================= RETURN ================= */
  return {
    header: {
      dataOperacional: dados.dataOperacional,
      turno: turnoKey,
      periodo: periodoLabel,
    },

    kpis: {
      colaboradoresPlanejados,
      colaboradoresPresentes,
      ausencias,
      absenteismo,
      diaristasPlanejados,
      diaristasPresentes,
      aderenciaDW,
      aderenciaTotal,
    },

    resumo: [
      {
        name: "HC",
        planejado: colaboradoresPlanejados,
        real: colaboradoresPresentes,
        gap: colaboradoresPlanejados - colaboradoresPresentes,
        aderencia:
          colaboradoresPlanejados > 0
            ? Math.round((colaboradoresPresentes / colaboradoresPlanejados) * 100)
            : 0,
      },
      {
        name: "DW",
        planejado: diaristasPlanejados,
        real: diaristasPresentes,
        gap: diaristasPlanejados - diaristasPresentes,
        aderencia: aderenciaDW,
      },
      {
        name: "Total",
        planejado: totalPlanejado,
        real: totalReal,
        gap: totalPlanejado - totalReal,
        aderencia: aderenciaTotal,
      },
    ],

    graficoPlanejadoVsReal: [
      { name: "HC", Planejado: colaboradoresPlanejados, Real: colaboradoresPresentes },
      { name: "DW", Planejado: diaristasPlanejados, Real: diaristasPresentes },
      { name: "Total", Planejado: totalPlanejado, Real: totalReal },
    ],

    // ✅ AQUI ESTAVA FALTANDO
    empresas,

    genero: normalizePie(dados.generoPorTurno?.[turnoKey], "name", "value"),

    statusColaboradores: normalizePie(
      dados.statusColaboradoresPorTurno?.[turnoKey],
      "status",
      "quantidade"
    ),

    vinculo: normalizePie(
      dados.distribuicaoVinculoPorTurno?.[turnoKey],
      "name",
      "value"
    ),

    setores,
    ausenciasHoje,

    insights: {
      atestados,
      faltas,
      aderenciaTotal,
    },
  }
}
