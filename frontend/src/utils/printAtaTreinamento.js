/* =====================================================
   PRINT ATA TREINAMENTO (LISTA DE PRESENÇA)
   - Modelo no padrão ShopeeXpress
   - Gera HTML A4, abre nova aba, chama window.print()
===================================================== */

import logoShopeeXpress from "../assets/spx-logo-orange.png";

/**
 * Formata uma data-only (string "YYYY-MM-DD" ou ISO timestamp) para "DD/MM/AAAA"
 * sem passar por `new Date(...)`, evitando o shift de 1 dia causado por fuso horário
 * (um "2026-07-21" vira meia-noite UTC, que em UTC-3 é 20/07 às 21h).
 */
function fmtDateOnlyBR(dateLike) {
  if (!dateLike) return "-";
  const str = typeof dateLike === "string" ? dateLike : new Date(dateLike).toISOString();
  const isoPart = str.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoPart)) return "-";
  return isoPart.split("-").reverse().join("/");
}

function fmtDateTimeAgoraBR() {
  const agora = new Date();
  const data = agora.toLocaleDateString("pt-BR");
  const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return { data, hora };
}

function normalizeCpf(cpf) {
  const v = String(cpf || "").replace(/\D/g, "");
  if (v.length !== 11) return cpf || "-";
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function calcCargaHoraria(treinamento) {
  const paraTexto = (minutos) => {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (h && m) return `${h}h${String(m).padStart(2, "0")}min`;
    if (h) return `${h}h`;
    return `${m}min`;
  };

  if (treinamento.tempoPrevistoMinutos) {
    return paraTexto(treinamento.tempoPrevistoMinutos);
  }

  if (treinamento.horarioInicio && treinamento.horarioFim) {
    const [h1, m1] = treinamento.horarioInicio.split(":").map(Number);
    const [h2, m2] = treinamento.horarioFim.split(":").map(Number);
    if (![h1, m1, h2, m2].some(Number.isNaN)) {
      const diff = h2 * 60 + m2 - (h1 * 60 + m1);
      if (diff > 0) return paraTexto(diff);
    }
  }

  return "-";
}

/* =====================================================
   FUNÇÃO PRINCIPAL
===================================================== */
export function printAtaTreinamento(treinamento) {
  if (!treinamento) {
    alert("Treinamento inválido");
    return;
  }

  const participantes = (treinamento.participantes || []).map((p) => ({
    nome: p.colaborador?.nomeCompleto || p.opsId || "-",
    cpf: normalizeCpf(p.cpf ?? p.colaborador?.cpf),
    setor: p.colaborador?.setor?.nomeSetor || "-",
    turno: p.colaborador?.turno?.nomeTurno || "-",
  }));

  const setores = (treinamento.setores || [])
    .map((s) => s.setor?.nomeSetor)
    .filter(Boolean)
    .join(", ");

  const { data: dataGeracao, hora: horaGeracao } = fmtDateTimeAgoraBR();

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Ata de Treinamento</title>

<style>
  @page { size: A4; margin: 12mm; }
  html { color-scheme: light only; background: #fff; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    background: #fff;
    font-size: 12px;
    margin: 0;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    border: 1px solid #000;
  }
  .header .logo-cell {
    flex: 0 0 auto;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    border-right: 1px solid #000;
  }
  .header .logo-cell img {
    height: 42px;
    width: auto;
  }
  .header .title-cell {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: .3px;
  }
  .header .rev-table {
    flex: 0 0 auto;
    border-collapse: collapse;
  }
  .header .rev-table td, .header .rev-table th {
    border-left: 1px solid #000;
    padding: 4px 10px;
    font-size: 9px;
    text-align: center;
  }
  .header .rev-table th {
    background: #e8e8e8;
    border-bottom: 1px solid #000;
    text-transform: uppercase;
    font-weight: 700;
  }

  .info-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #000;
    border-top: none;
  }
  .info-table td {
    border: 1px solid #000;
    padding: 6px 8px;
    vertical-align: top;
  }
  .info-table .field-label {
    font-size: 9px;
    text-transform: uppercase;
    color: #444;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .info-table .field-value {
    font-size: 12px;
    font-weight: 600;
  }

  .checkbox {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 1px solid #111;
    margin-right: 4px;
    vertical-align: middle;
  }

  table.participantes {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #000;
    border-top: none;
    font-size: 11px;
  }
  table.participantes th, table.participantes td {
    border: 1px solid #000;
    padding: 6px 8px;
    text-align: left;
  }
  table.participantes th {
    background: #e8e8e8;
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 700;
  }
  table.participantes td.num {
    width: 28px;
    text-align: center;
  }
  .sig-cell {
    height: 20px;
  }

  .assinatura-instrutor {
    margin-top: 24px;
    font-size: 12px;
  }
  .assinatura-instrutor .linha {
    display: inline-block;
    border-bottom: 1px solid #111;
    width: 320px;
    margin-left: 8px;
  }

  .rodape {
    margin-top: 16px;
    font-size: 9px;
    color: #666;
  }
</style>
</head>

<body>

  <!-- CABEÇALHO -->
  <div class="header">
    <div class="logo-cell">
      <img src="${logoShopeeXpress}" alt="ShopeeXpress" />
    </div>
    <div class="title-cell">LISTA DE PRESENÇA</div>
    <table class="rev-table">
      <tr>
        <th>Data Geração</th>
        <th>Página</th>
      </tr>
      <tr>
        <td>${dataGeracao}</td>
        <td>1 de 1</td>
      </tr>
    </table>
  </div>

  <!-- DADOS DO TREINAMENTO -->
  <table class="info-table">
    <tr>
      <td colspan="3">
        <div class="field-label">Título do Treinamento</div>
        <div class="field-value">${treinamento.tema || "-"}</div>
      </td>
    </tr>
    <tr>
      <td>
        <div class="field-label">Data</div>
        <div class="field-value">${fmtDateOnlyBR(treinamento.dataTreinamento)}</div>
      </td>
      <td>
        <div class="field-label">Horário</div>
        <div class="field-value">${treinamento.horarioInicio || "-"}${treinamento.horarioFim ? ` às ${treinamento.horarioFim}` : ""}</div>
      </td>
      <td>
        <div class="field-label">Carga Horária</div>
        <div class="field-value">${calcCargaHoraria(treinamento)}</div>
      </td>
    </tr>
    <tr>
      <td>
        <div class="field-label">Instrutor</div>
        <div class="field-value">${treinamento.liderResponsavel?.nomeCompleto || "-"}</div>
      </td>
      <td>
        <div class="field-label">Local</div>
        <div class="field-value">${treinamento.local || setores || "-"}</div>
      </td>
      <td>
        <div class="field-label">Avaliação?</div>
        <div class="field-value"><span class="checkbox"></span>Sim &nbsp; <span class="checkbox"></span>Não</div>
      </td>
    </tr>
    <tr>
      <td colspan="3">
        <div class="field-label">Assuntos abordados</div>
        <div class="field-value">${treinamento.observacoes || treinamento.processo || "-"}</div>
      </td>
    </tr>
  </table>

  <!-- PARTICIPANTES -->
  <table class="participantes">
    <thead>
      <tr>
        <th class="num">Nº</th>
        <th>Nome Completo</th>
        <th>CPF</th>
        <th>Setor</th>
        <th>Turno</th>
        <th>Assinatura</th>
      </tr>
    </thead>
    <tbody>
      ${participantes
        .map(
          (p, idx) => `
        <tr>
          <td class="num">${idx + 1}</td>
          <td>${p.nome}</td>
          <td>${p.cpf}</td>
          <td>${p.setor}</td>
          <td>${p.turno}</td>
          <td class="sig-cell"></td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <div class="assinatura-instrutor">
    Assinatura Instrutor: <span class="linha"></span>
  </div>

  <div class="rodape">
    Documento interno • Controle de Treinamentos • Gerado em ${dataGeracao} às ${horaGeracao}
  </div>
</body>
</html>
`;

  const win = window.open("", "_blank");
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
