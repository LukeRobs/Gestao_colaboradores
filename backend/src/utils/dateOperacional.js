

function getDateOperacional(baseDate) {
  const d = new Date(baseDate);
  const minutos = d.getHours() * 60 + d.getMinutes();

  const inRange = (s, e) =>
    s <= e ? minutos >= s && minutos <= e : minutos >= s || minutos <= e;

  let turno;
  let diaOperacional = new Date(d);

  if (inRange(21 * 60, 5 * 60 + 24)) {
    turno = "T3";
  } else if (inRange(13 * 60 + 20, 23 * 60)) {
    turno = "T2";
  } else if (inRange(5 * 60 + 25, 13 * 60 + 19)) {
    turno = "T1";
  } else {
    turno = "T1";
  }

  // 🔑 REGRA DE VIRADA DO DIA
  // O dia só muda quando começa o T1
  if (turno === "T1" && minutos < 13 * 60 + 20) {
    // novo dia (já está correto)
  } else {
    // mantém o mesmo dia
  }

  diaOperacional.setHours(0, 0, 0, 0);

  return {
    turnoAtual: turno,
    dataOperacional: diaOperacional,
    dataOperacionalStr: diaOperacional.toISOString().slice(0, 10),
  };
}

module.exports = {
  getDateOperacional,
};
