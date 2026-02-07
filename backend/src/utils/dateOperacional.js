function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatYMD(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(date, delta) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function getDateOperacional(baseDate) {
  const d = new Date(baseDate);
  const horas = d.getHours();
  const minutosTotais = horas * 60 + d.getMinutes();

  const T1_TOLERANCIA = 25; // minutos
  const T2_TOLERANCIA = 20;
  const T1_START = 5 * 60 + 25;   // 05:25
  const T2_START = 13 * 60 + 20;  // 13:20
  const T3_START = 20 * 60 + 50;       // 20:50

  let turnoAtual;

  if (minutosTotais >= T1_START - T1_TOLERANCIA && minutosTotais < T2_START) {
    turnoAtual = "T1";
  } else if (minutosTotais >= T2_START - T2_TOLERANCIA && minutosTotais < T3_START) {
    turnoAtual = "T2";
  } else {
    turnoAtual = "T3";
  }

  // 🔑 REGRA CORRETA DO DIA OPERACIONAL
  // Se for T3 e ainda não chegou 05:25 → dia operacional = ontem
  const diaOperacional =
    turnoAtual === "T3" && minutosTotais < T1_START
      ? addDays(d, -1)
      : d;

  const dataOperacionalStr = formatYMD(diaOperacional);

  return {
    turnoAtual,
    dataOperacional: diaOperacional,
    dataOperacionalStr,
  };
}

module.exports = {
  getDateOperacional,
};
