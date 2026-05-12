/* =====================================================
   PRINT ATA TREINAMENTO
   - Gera HTML A4
   - Abre nova aba
   - Chama window.print()
===================================================== */

function fmtDateBR(dateLike) {
  if (!dateLike) return "-";
  const d = new Date(dateLike);
  return d.toLocaleDateString("pt-BR");
}

function fmtTimeBR(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeCpf(cpf) {
  const v = String(cpf || "").replace(/\D/g, "");
  if (v.length !== 11) return cpf || "-";
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
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
    cpf: normalizeCpf(p.cpf),
    setor: p.colaborador?.setor?.nomeSetor || "-",
    turno: p.colaborador?.turno?.nomeTurno || "-",
  }));

  const setores = (treinamento.setores || [])
    .map((s) => s.setor?.nomeSetor)
    .filter(Boolean)
    .join(", ");

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Ata de Treinamento</title>

<style>
  @page { size: A4; margin: 14mm; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    font-size: 12px;
  }
  h1 {
    font-size: 18px;
    border-bottom: 2px solid #FA4C00;
    padding-bottom: 6px;
  }
  .meta {
    margin: 10px 0;
    font-size: 11px;
    color: #444;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 12px;
  }
  .box {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px;
  }
  .label {
    font-size: 10px;
    color: #555;
    text-transform: uppercase;
  }
  .value {
    font-weight: bold;
    margin-top: 4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 16px;
    font-size: 11px;
  }
  th, td {
    border-bottom: 1px solid #ddd;
    padding: 6px;
    text-align: left;
  }
  th {
    font-size: 10px;
    text-transform: uppercase;
  }
  .sig {
    height: 22px;
    border-bottom: 1px solid #111;
  }
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 24px;
  }
  .sign {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 10px;
  }
</style>
</head>

<body>
  <h1>ATA DE TREINAMENTO</h1>

  <div class="meta">
    Data do treinamento: <b>${fmtDateBR(treinamento.dataTreinamento)}</b><br/>
    SOC: <b>${treinamento.soc}</b> • Processo: <b>${treinamento.processo}</b><br/>
    Gerado em: ${fmtDateBR(new Date())} às ${fmtTimeBR(new Date())}
  </div>

  <div class="grid">
    <div class="box">
      <div class="label">Tema</div>
      <div class="value">${treinamento.tema}</div>
    </div>

    <div class="box">
      <div class="label">Instrutor / Líder</div>
      <div class="value">
        ${treinamento.liderResponsavel?.nomeCompleto || "-"}
      </div>
    </div>

    <div class="box">
      <div class="label">Setores</div>
      <div class="value">${setores || "-"}</div>
    </div>

    <div class="box">
      <div class="label">Status</div>
      <div class="value">${treinamento.status}</div>
    </div>
  </div>

  <h3 style="margin-top:20px">Participantes</h3>

  <table>
    <thead>
      <tr>
        <th>Nome</th>
        <th>CPF</th>
        <th>Setor</th>
        <th>Turno</th>
        <th>Assinatura</th>
      </tr>
    </thead>
    <tbody>
      ${participantes
        .map(
          (p) => `
        <tr>
          <td>${p.nome}</td>
          <td>${p.cpf}</td>
          <td>${p.setor}</td>
          <td>${p.turno}</td>
          <td><div class="sig"></div></td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sign">
      <b>${treinamento.liderResponsavel?.nomeCompleto || "-"}</b><br/>
      Líder / Instrutor<br/><br/>
      <div class="sig"></div>
    </div>

    <div class="sign">
      <b>RH / Gestão</b><br/>
      Validação<br/><br/>
      <div class="sig"></div>
    </div>
  </div>

  <p style="margin-top:20px;font-size:10px;color:#444">
    Documento interno • Controle de Treinamentos
  </p>
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
