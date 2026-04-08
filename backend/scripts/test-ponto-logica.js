/**
 * TEST-PONTO-LOGICA.JS
 * Testa toda a lógica de negócio do registrarPontoCPF sem tocar no banco.
 * Rodar: node scripts/test-ponto-logica.js
 */

/* ─────────────────────────────────────────
   CÓPIA DAS FUNÇÕES PURAS DO CONTROLLER
   (sem dependência de prisma / express)
───────────────────────────────────────── */

function startOfDay(dateObj) {
  const d = new Date(dateObj);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function getDateOperacional(baseDate) {
  const d = new Date(baseDate);
  const horas = d.getHours();
  const minutosTotais = horas * 60 + d.getMinutes();

  const T1_TOLERANCIA = 25;
  const T2_TOLERANCIA = 20;
  const T1_START = 5 * 60 + 25;   // 05:25
  const T2_START = 13 * 60 + 20;  // 13:20
  const T3_START = 20 * 60 + 50;  // 20:50
  const T3_END   = 6 * 60 + 20;   // 06:20

  let turnoAtual;
  if (minutosTotais >= T1_START - T1_TOLERANCIA && minutosTotais < T2_START) {
    turnoAtual = "T1";
  } else if (minutosTotais >= T2_START - T2_TOLERANCIA && minutosTotais < T3_START) {
    turnoAtual = "T2";
  } else {
    turnoAtual = "T3";
  }

  const diaOperacional =
    turnoAtual === "T3" && minutosTotais < T3_END
      ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
      : d;

  return { turnoAtual, dataOperacional: diaOperacional };
}

function isDiaDSR(dataOperacional, nomeEscala) {
  const dow = new Date(dataOperacional).getUTCDay();
  const dsrMap = {
    E: [0, 1],
    G: [2, 3],
    C: [4, 5],
  };
  const dias = dsrMap[String(nomeEscala || "").toUpperCase()];
  return !!dias?.includes(dow);
}

function timeToMinutes(timeDate) {
  const d = new Date(timeDate);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function nowToMinutes(dateObj) {
  const d = new Date(dateObj);
  return d.getHours() * 60 + d.getMinutes();
}

function toTimeOnly(dateObj) {
  const d = new Date(dateObj);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return new Date(`1970-01-01T${hh}:${mm}:00.000Z`);
}

/**
 * Simula registrarPontoCPF com dados mockados (sem banco).
 * agora         = Date do "momento" da batida
 * colaborador   = { turno: { nomeTurno }, escala: { nomeEscala }, ausencias: [], atestadosMedicos: [] }
 * abertaMock    = frequência aberta (sem horaSaida) ou null
 *                 Se for registro DSR (horaEntrada = null), simula o que o banco retornaria ANTES do fix
 *                 Se for null ou com horaEntrada, simula após o fix
 * frequenciaDiaMock = registro do dia operacional (para detectar DSR pré-gerado) ou null
 */
function simularRegistro({ agora, colaborador, abertaMock, frequenciaDiaMock }) {
  const { dataOperacional, turnoAtual } = getDateOperacional(agora);
  const dataReferenciaOperacional = startOfDay(dataOperacional);

  // ── BLOQUEIO S1 ──
  if (frequenciaDiaMock?.tipoAusencia?.codigo === "S1") {
    return { ok: false, msg: "Este dia está marcado como Sinergia Enviada (S1)." };
  }

  const isT3Worker =
    colaborador.turno?.nomeTurno?.toUpperCase().includes("T3") ||
    colaborador.turno?.nomeTurno?.toUpperCase().includes("NOTURNO");

  // ── BLOQUEIO ANTECIPAÇÃO T3 ──
  if (!abertaMock && isT3Worker && turnoAtual !== "T3") {
    return { ok: false, msg: "Ponto liberado para o T3 somente a partir das 20:50" };
  }

  // ── BLOQUEIO SAÍDA T3 SEM JORNADA ABERTA ──
  if (!abertaMock && turnoAtual === "T1" && isT3Worker) {
    return { ok: false, msg: "Saída T3: nenhuma jornada aberta encontrada." };
  }

  const nomeEscalaDia = colaborador.escala?.nomeEscala;

  // ── BLOQUEIOS ADMINISTRATIVOS (só para ENTRADA) ──
  if (!abertaMock) {
    if (isDiaDSR(dataReferenciaOperacional, nomeEscalaDia)) {
      return { ok: false, msg: "Hoje é DSR do colaborador" };
    }
    if (colaborador.ausencias?.length > 0) {
      return { ok: false, msg: "Colaborador possui ausência ativa" };
    }
    if (colaborador.atestadosMedicos?.length > 0) {
      return { ok: false, msg: "Colaborador possui atestado médico ativo" };
    }
  }

  // ── FECHAR FREQUÊNCIA ABERTA (SAÍDA) ──
  if (abertaMock?.horaEntrada && !abertaMock?.horaSaida) {
    const entradaMin = timeToMinutes(abertaMock.horaEntrada);
    const agoraMin   = nowToMinutes(agora);
    let minutosDecorridos = agoraMin - entradaMin;
    if (minutosDecorridos < 0) minutosDecorridos += 24 * 60;

    if (minutosDecorridos < 60) {
      return { ok: false, msg: `Saída permitida somente após 1h. Aguarde mais ${60 - minutosDecorridos} min.` };
    }
    if (minutosDecorridos > 24 * 60) {
      return { ok: false, msg: "Frequência aberta há mais de 24h. Procure o RH." };
    }

    const horasTrabalhadas = Number((minutosDecorridos / 60).toFixed(2));
    return {
      ok: true,
      tipo: "SAÍDA",
      msg: "Saída registrada com sucesso",
      horasTrabalhadas,
      dataOperacional: dataOperacional.toISOString().slice(0, 10),
      turnoAtual,
    };
  }

  // ── JORNADA DUPLICADA ──
  if (frequenciaDiaMock?.horaEntrada && frequenciaDiaMock?.horaSaida) {
    return { ok: false, msg: "Já existe uma jornada finalizada para este dia operacional" };
  }

  // ── CORRIGE REGISTRO INCONSISTENTE (só sem aberta) ──
  if (!abertaMock && frequenciaDiaMock && !frequenciaDiaMock.horaEntrada) {
    return { ok: true, tipo: "ENTRADA (correção)", msg: "Entrada registrada com sucesso (correção)" };
  }

  // ── GUARDA: não criar se aberta existe (estado corrompido) ──
  if (abertaMock) {
    return { ok: false, msg: "Existe uma jornada aberta sem saída registrada. Solicite ajuste ao RH." };
  }

  // ── CRIA ENTRADA ──
  if (turnoAtual === "T1" && isT3Worker) {
    return { ok: false, msg: "Horário incompatível para nova entrada T3. Solicite ajuste ao RH." };
  }

  return {
    ok: true,
    tipo: "ENTRADA",
    msg: "Entrada registrada com sucesso",
    dataOperacional: dataOperacional.toISOString().slice(0, 10),
    turnoAtual,
  };
}

/* ─────────────────────────────────────────
   HELPERS DE TESTE
───────────────────────────────────────── */

let passou = 0;
let falhou = 0;

function makeDate(dateStr, timeStr) {
  // Cria um Date local no fuso horário do processo (simula agoraBrasil())
  return new Date(`${dateStr}T${timeStr}:00`);
}

function makeHoraEntradaDB(timeStr) {
  // Simula como o banco armazena: Time(6) em UTC
  return new Date(`1970-01-01T${timeStr}:00.000Z`);
}

function assert(descricao, resultado, esperado) {
  const ok = resultado.ok === esperado.ok &&
    (!esperado.tipo || resultado.tipo === esperado.tipo) &&
    (!esperado.msgContains || resultado.msg?.includes(esperado.msgContains));

  if (ok) {
    console.log(`  ✅ ${descricao}`);
    console.log(`     → ${resultado.tipo || (resultado.ok ? "OK" : "ERRO")}: ${resultado.msg}`);
    if (resultado.horasTrabalhadas) console.log(`     → Horas trabalhadas: ${resultado.horasTrabalhadas}h`);
    passou++;
  } else {
    console.log(`  ❌ ${descricao}`);
    console.log(`     Esperado: ok=${esperado.ok} tipo=${esperado.tipo || "*"} msgContains="${esperado.msgContains || "*"}"`);
    console.log(`     Obtido:   ok=${resultado.ok} tipo=${resultado.tipo || "-"} msg="${resultado.msg}"`);
    falhou++;
  }
}

const colaboradorT3 = {
  turno: { nomeTurno: "T3" },
  escala: { nomeEscala: "G" }, // DSR: terça e quarta
  ausencias: [],
  atestadosMedicos: [],
};

/* ─────────────────────────────────────────
   CENÁRIO 1
   Entrada: 21:00 dia 05/04 (domingo)
   Saída:   06:00 dia 06/04 (segunda)
   Escala G → DSR: terça(2) e quarta(3) — 06/04 é segunda, NÃO é DSR
───────────────────────────────────────── */
console.log("\n═══════════════════════════════════════════");
console.log("CENÁRIO 1 — T3 normal: entrada 21:00/05-04, saída 06:00/06-04");
console.log("═══════════════════════════════════════════");

// 1a: ENTRADA às 21:00 do dia 05/04
const c1_entrada = simularRegistro({
  agora: makeDate("2026-04-05", "21:00"),
  colaborador: colaboradorT3,
  abertaMock: null,
  frequenciaDiaMock: null,
});
assert("Entrada T3 às 21:00 do dia 05/04", c1_entrada, { ok: true, tipo: "ENTRADA" });

// 1b: SAÍDA às 06:00 do dia 06/04 — aberta existe com entrada do dia anterior
const c1_saida = simularRegistro({
  agora: makeDate("2026-04-06", "06:00"),
  colaborador: colaboradorT3,
  abertaMock: {
    horaEntrada: makeHoraEntradaDB("21:00"), // 21:00 UTC (entrada do dia 05/04)
    horaSaida: null,
    dataReferencia: new Date("2026-04-05"),
  },
  frequenciaDiaMock: null,
});
assert("Saída T3 às 06:00 do dia 06/04 (dia normal)", c1_saida, { ok: true, tipo: "SAÍDA" });

/* ─────────────────────────────────────────
   CENÁRIO 2
   Entrada: 20:55 dia 01/04 (quarta)
   Saída:   05:55 dia 02/04 (quinta) — DSR da escala G (quarta=3, quinta=4... espera, G=[2,3]=terça,quarta)

   Escala G → DSR: terça(2) e quarta(3)
   02/04/2026 é quinta-feira (dow=4) → NÃO é DSR da escala G

   Mas o enunciado diz "dia 02/04 é o DSR dele" — vamos usar escala C (DSR: quinta=4 e sexta=5)
   para simular exatamente o cenário descrito pelo usuário.
───────────────────────────────────────── */
console.log("\n═══════════════════════════════════════════");
console.log("CENÁRIO 2 — T3 com DSR no dia seguinte: entrada 20:55/01-04, saída 05:55/02-04 (DSR)");
console.log("═══════════════════════════════════════════");

// 02/04/2026 = quinta-feira (dow UTC = 4) → escala C tem DSR quinta(4) e sexta(5) ✓
const colaboradorT3_C = {
  turno: { nomeTurno: "T3" },
  escala: { nomeEscala: "C" }, // DSR: quinta e sexta
  ausencias: [],
  atestadosMedicos: [],
};

// 2a: ENTRADA às 20:55 do dia 01/04
const c2_entrada = simularRegistro({
  agora: makeDate("2026-04-01", "20:55"),
  colaborador: colaboradorT3_C,
  abertaMock: null,
  frequenciaDiaMock: null,
});
assert("Entrada T3 às 20:55 do dia 01/04", c2_entrada, { ok: true, tipo: "ENTRADA" });

// 2b: SAÍDA às 05:55 do dia 02/04
// abertaMock = entrada real do dia 01/04 (horaEntrada NOT NULL) — fix aplicado na query
// frequenciaDiaMock = registro DSR de 02/04 (horaEntrada = null) — mas aberta ignora esse
const c2_saida = simularRegistro({
  agora: makeDate("2026-04-02", "05:55"),
  colaborador: colaboradorT3_C,
  abertaMock: {
    horaEntrada: makeHoraEntradaDB("20:55"),
    horaSaida: null,
    dataReferencia: new Date("2026-04-01"),
  },
  frequenciaDiaMock: {
    // Registro DSR pré-gerado de 02/04 (horaEntrada = null)
    horaEntrada: null,
    horaSaida: null,
    tipoAusencia: { codigo: "DSR" },
  },
});
assert("Saída T3 às 05:55 do dia 02/04 (dia de DSR) — deve registrar saída do dia 01/04", c2_saida, { ok: true, tipo: "SAÍDA" });

// 2c: BUG ANTIGO — simula comportamento ANTES do fix (aberta retornava o registro DSR)
console.log("\n  [comparação] Comportamento ANTES do fix (aberta = registro DSR):");
const c2_bug_antigo = simularRegistro({
  agora: makeDate("2026-04-02", "05:55"),
  colaborador: colaboradorT3_C,
  abertaMock: {
    horaEntrada: null, // DSR não tem horaEntrada
    horaSaida: null,
    dataReferencia: new Date("2026-04-02"),
  },
  frequenciaDiaMock: null,
});
assert("Bug antigo: aberta = DSR → deveria FALHAR", c2_bug_antigo, { ok: false, msgContains: "jornada aberta" });

/* ─────────────────────────────────────────
   CENÁRIO 3 — Bloqueio antecipação T3
   Colaborador T3 tenta bater às 19:00 (antes das 20:50)
───────────────────────────────────────── */
console.log("\n═══════════════════════════════════════════");
console.log("CENÁRIO 3 — Bloqueio antecipação T3");
console.log("═══════════════════════════════════════════");

const c3 = simularRegistro({
  agora: makeDate("2026-04-07", "19:00"),
  colaborador: colaboradorT3,
  abertaMock: null,
  frequenciaDiaMock: null,
});
assert("T3 tenta entrar às 19:00 → bloqueado", c3, { ok: false, msgContains: "20:50" });

/* ─────────────────────────────────────────
   CENÁRIO 4 — DSR bloqueia ENTRADA mas não SAÍDA
   Colaborador entra em dia normal, sai em dia de DSR (T1 window)
───────────────────────────────────────── */
console.log("\n═══════════════════════════════════════════");
console.log("CENÁRIO 4 — DSR bloqueia entrada mas não saída");
console.log("═══════════════════════════════════════════");

// Tenta bater ENTRADA num dia de DSR sem jornada aberta → bloqueado
// 02/04/2026 = quinta, escala C = DSR
const c4_entrada_dsr = simularRegistro({
  agora: makeDate("2026-04-02", "21:00"),
  colaborador: colaboradorT3_C,
  abertaMock: null,
  frequenciaDiaMock: null,
});
assert("T3 tenta ENTRADA em dia de DSR → bloqueado", c4_entrada_dsr, { ok: false, msgContains: "DSR" });

// Tenta bater SAÍDA em dia de DSR com jornada aberta → permitido
const c4_saida_dsr = simularRegistro({
  agora: makeDate("2026-04-02", "05:30"),
  colaborador: colaboradorT3_C,
  abertaMock: {
    horaEntrada: makeHoraEntradaDB("21:00"),
    horaSaida: null,
    dataReferencia: new Date("2026-04-01"),
  },
  frequenciaDiaMock: null,
});
assert("T3 bate SAÍDA com jornada aberta em dia de DSR → permitido", c4_saida_dsr, { ok: true, tipo: "SAÍDA" });

/* ─────────────────────────────────────────
   CENÁRIO 5 — Bloqueio 1h mínima
───────────────────────────────────────── */
console.log("\n═══════════════════════════════════════════");
console.log("CENÁRIO 5 — Bloqueio saída antes de 1h");
console.log("═══════════════════════════════════════════");

const c5 = simularRegistro({
  agora: makeDate("2026-04-07", "22:30"), // só 30min após entrada
  colaborador: colaboradorT3,
  abertaMock: {
    horaEntrada: makeHoraEntradaDB("22:00"),
    horaSaida: null,
    dataReferencia: new Date("2026-04-07"),
  },
  frequenciaDiaMock: null,
});
assert("Saída 30min após entrada → bloqueado (falta 30min)", c5, { ok: false, msgContains: "1h" });

/* ─────────────────────────────────────────
   CENÁRIO 6 — Jornada duplicada
───────────────────────────────────────── */
console.log("\n═══════════════════════════════════════════");
console.log("CENÁRIO 6 — Jornada já finalizada");
console.log("═══════════════════════════════════════════");

// 08/04/2026 = quarta (dow=3) → escala G tem DSR quarta(3), então usamos escala E (DSR: dom/seg)
// 08/04 = quarta → NÃO é DSR de escala E
const colaboradorT3_E = {
  turno: { nomeTurno: "T3" },
  escala: { nomeEscala: "E" }, // DSR: domingo(0) e segunda(1)
  ausencias: [],
  atestadosMedicos: [],
};
const c6 = simularRegistro({
  agora: makeDate("2026-04-08", "21:00"),
  colaborador: colaboradorT3_E,
  abertaMock: null,
  frequenciaDiaMock: {
    horaEntrada: makeHoraEntradaDB("21:00"),
    horaSaida: makeHoraEntradaDB("06:00"),
  },
});
assert("Segunda batida com jornada já finalizada → bloqueado", c6, { ok: false, msgContains: "jornada finalizada" });

/* ─────────────────────────────────────────
   CENÁRIO 7 — Saída T3 na janela T1 sem jornada aberta (guard)
───────────────────────────────────────── */
console.log("\n═══════════════════════════════════════════");
console.log("CENÁRIO 7 — T3 na janela T1 sem jornada aberta");
console.log("═══════════════════════════════════════════");

// Às 06:00 turnoAtual="T1" (já passou 05:25) → isT3Worker sem aberta
// O bloco "ANTECIPAÇÃO T3" dispara: !aberta && isT3Worker && turnoAtual !== "T3"
// que é o guard correto — impede entrada T3 fora do horário sem aberta
const c7 = simularRegistro({
  agora: makeDate("2026-04-07", "06:00"),
  colaborador: colaboradorT3,
  abertaMock: null,
  frequenciaDiaMock: null,
});
assert("T3 na janela T1 sem aberta → bloqueado", c7, { ok: false, msgContains: "20:50" });

/* ─────────────────────────────────────────
   CENÁRIO 8 — T1/T2 normais
───────────────────────────────────────── */
console.log("\n═══════════════════════════════════════════");
console.log("CENÁRIO 8 — T1 e T2 normais");
console.log("═══════════════════════════════════════════");

const colaboradorT1 = {
  turno: { nomeTurno: "T1" },
  escala: { nomeEscala: "E" },
  ausencias: [],
  atestadosMedicos: [],
};

const c8_t1_entrada = simularRegistro({
  agora: makeDate("2026-04-07", "05:30"),
  colaborador: colaboradorT1,
  abertaMock: null,
  frequenciaDiaMock: null,
});
assert("T1 entrada às 05:30 → permitido", c8_t1_entrada, { ok: true, tipo: "ENTRADA" });

const c8_t1_saida = simularRegistro({
  agora: makeDate("2026-04-07", "14:00"),
  colaborador: colaboradorT1,
  abertaMock: {
    horaEntrada: makeHoraEntradaDB("05:30"),
    horaSaida: null,
    dataReferencia: new Date("2026-04-07"),
  },
  frequenciaDiaMock: null,
});
assert("T1 saída às 14:00 (8:30h trabalhadas) → permitido", c8_t1_saida, { ok: true, tipo: "SAÍDA" });

/* ─────────────────────────────────────────
   RESULTADO FINAL
───────────────────────────────────────── */
console.log("\n═══════════════════════════════════════════");
console.log(`RESULTADO: ${passou} passaram ✅  |  ${falhou} falharam ❌`);
console.log("═══════════════════════════════════════════\n");

if (falhou > 0) process.exit(1);
