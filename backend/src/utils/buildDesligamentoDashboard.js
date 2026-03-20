function normalize(value, fallback = "NÃO INFORMADO") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return value;
}

function inc(obj, key) {
  const k = normalize(key);
  obj[k] = (obj[k] || 0) + 1;
}

function getFaixaTempo(dias) {
  if (dias <= 30) return "0-30";
  if (dias <= 90) return "31-90";
  if (dias <= 180) return "91-180";
  return "180+";
}

function getTop(obj) {
  const sorted = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return { label: "N/A", value: 0 };

  return {
    label: sorted[0][0],
    value: sorted[0][1],
  };
}

function buildDesligamentoDashboard(data) {
  const resumo = {
    total: data.length,

    motivos: {},
    turno: {},
    empresa: {},
    setor: {},
    lider: {},
    genero: {},
    tipo: {},

    tempoCasa: {
      "0-30": 0,
      "31-90": 0,
      "91-180": 0,
      "180+": 0,
    },

    indicadores: {
      tempoMedioCasa: 0,
      desligamentoPrecoce: 0,
    },

    insights: {},
  };

  let somaTempo = 0;

  data.forEach((d) => {
    const motivo = normalize(d.motivoDesligamento);
    const tipo = normalize(d.tipoDesligamento);

    const empresa = normalize(d?.empresa?.razaoSocial);
    const setor = normalize(d?.setor?.nomeSetor);
    const turno = normalize(d?.turno?.nomeTurno);
    const lider = normalize(d?.lider?.nomeCompleto);
    const genero = normalize(d?.genero);

    // 🔥 proteção contra datas inválidas
    let dias = 0;
    if (d.dataAdmissao && d.dataDesligamento) {
      dias =
        (new Date(d.dataDesligamento) - new Date(d.dataAdmissao)) /
        (1000 * 60 * 60 * 24);
    }

    somaTempo += dias;

    const faixa = getFaixaTempo(dias);

    // contadores
    inc(resumo.motivos, motivo);
    inc(resumo.tipo, tipo);
    inc(resumo.empresa, empresa);
    inc(resumo.setor, setor);
    inc(resumo.turno, turno);
    inc(resumo.lider, lider);
    inc(resumo.genero, genero);

    resumo.tempoCasa[faixa]++;

    if (dias <= 30) resumo.indicadores.desligamentoPrecoce++;
  });

  // média tempo casa
  if (data.length > 0) {
    resumo.indicadores.tempoMedioCasa = Math.round(
      somaTempo / data.length
    );
  }

  // 🔥 INSIGHTS PRONTOS PRO FRONT
  resumo.insights = {
    principalMotivo: getTop(resumo.motivos),
    tipoMaisComum: getTop(resumo.tipo),
    turnoCritico: getTop(resumo.turno),
    empresaCritica: getTop(resumo.empresa),
    setorCritico: getTop(resumo.setor),
    liderDestaque: getTop(resumo.lider),
    generoDestaque: getTop(resumo.genero),
  };

  return resumo;
}

module.exports = { buildDesligamentoDashboard };