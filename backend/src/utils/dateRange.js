function parseLocalDate(iso) {
  // iso = "YYYY-MM-DD"
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDayLocal(iso) {
  const d = parseLocalDate(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDayLocal(iso) {
  const d = parseLocalDate(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}


function getPeriodoFiltro(query = {}) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // 📅 DIA ÚNICO
  if (query.data) {
    return {
      inicio: startOfDayLocal(query.data),
      fim: endOfDayLocal(query.data),
    };
  }

  // 📅 INTERVALO MANUAL
  if (query.dataInicio && query.dataFim) {
    return {
      inicio: startOfDayLocal(query.dataInicio),
      fim: endOfDayLocal(query.dataFim),
    };
  }

  // ⚡ PRESET (ex: 7d, 30d)
  if (query.periodo) {
    const dias = Number(query.periodo.replace("d", ""));
    if (!isNaN(dias) && dias > 0) {
      const inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() - (dias - 1));
      return {
        inicio,
        fim: endOfDayLocal(
          `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`
        ),
      };
    }
  }

  // ✅ DEFAULT — últimos 30 dias
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 29);

  const fimISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  return {
    inicio,
    fim: endOfDayLocal(fimISO),
  };
}


module.exports = { getPeriodoFiltro };
