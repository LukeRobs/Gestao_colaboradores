/* =====================================================
   ATA TREINAMENTO — TEMPLATE (HTML PRINT A4)
   - Renderiza uma ata pronta para imprimir
===================================================== */

function fmtDateBR(dateLike) {
  if (!dateLike) return "-";
  const d = new Date(dateLike);
  return d.toLocaleDateString("pt-BR");
}

function fmtTimeBR(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function normalizeCpf(cpf) {
  const v = String(cpf || "").replace(/\D/g, "");
  if (v.length !== 11) return cpf || "-";
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export default function AtaTreinamentoTemplate({
  treinamento,
  empresa = "Shopee Brasil",
  unidade = "SoC",
  instrutorNome, // opcional: se quiser sobrescrever
  instrutorCargo, // opcional
}) {
  if (!treinamento) return null;

  const dataTreinamento = fmtDateBR(treinamento.dataTreinamento);
  const horaGeracao = fmtTimeBR(new Date());

  const lider = instrutorNome || treinamento.liderResponsavel?.nomeCompleto || "-";
  const setores = (treinamento.setores || [])
    .map((s) => s?.setor?.nomeSetor)
    .filter(Boolean);

  const participantes = (treinamento.participantes || []).map((p) => ({
    nome: p?.colaborador?.nomeCompleto || p?.opsId || "-",
    cpf: normalizeCpf(p?.cpf),
    setor:
      p?.colaborador?.setor?.nomeSetor ||
      "-", // se no include vier colaborador.setor no futuro
    assinatura: "",
  }));

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Ata de Treinamento</title>

        <style>{`
/* ===== PRINT SETUP ===== */
@page { size: A4; margin: 14mm; }

* { box-sizing: border-box; }

body {
  font-family: Arial, Helvetica, sans-serif;
  color: #111;
  margin: 0;
  padding: 0;
  background: #f4f6f8; /* fundo tela */
}

/* ===== PAGE CONTAINER ===== */
.page {
  width: 100%;
  max-width: 210mm; /* largura A4 */
  margin: 24px auto;
  padding: 24px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
  border-radius: 12px;
}

/* ===== HEADER ===== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  border-bottom: 2px solid #FA4C00;
  padding-bottom: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.brand .company {
  font-size: 18px;
  font-weight: 700;
}

.brand .sub {
  font-size: 13px;
  color: #444;
}

.doc-title {
  text-align: right;
}

.doc-title .title {
  font-size: 20px;
  font-weight: 800;
  margin: 0;
}

.doc-title .meta {
  font-size: 12px;
  color: #444;
  margin-top: 4px;
}

/* ===== SECTIONS ===== */
.section {
  margin: 18px 0;
}

.section h2 {
  font-size: 13px;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: #222;
}

/* ===== GRID ===== */
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  font-size: 13px;
}

.field {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  background: #fafafa;
}

.label {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.value {
  font-size: 13px;
  font-weight: 700;
  word-break: break-word;
}

/* ===== CHIPS ===== */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.chip {
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  background: #fff;
}

/* ===== TABLE RESPONSIVA ===== */
.table-wrapper {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  min-width: 600px; /* evita esmagar colunas */
}

thead th {
  text-align: left;
  padding: 10px 8px;
  border-bottom: 2px solid #111;
  font-size: 11px;
  text-transform: uppercase;
}

tbody td {
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.sig {
  height: 22px;
  border-bottom: 1px solid #111;
}

/* ===== ASSINATURAS ===== */
.sign-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

.sign {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
}

.sign .line {
  border-bottom: 1px solid #111;
  height: 18px;
  margin: 10px 0 6px 0;
}

.sign .who {
  font-size: 13px;
  font-weight: 700;
}

.sign .role {
  font-size: 11px;
  color: #666;
}

/* ===== NOTES ===== */
.notes {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  min-height: 90px;
  font-size: 12px;
  line-height: 1.5;
  background: #fafafa;
}

/* ===== FOOTER ===== */
.footer {
  margin-top: 18px;
  font-size: 11px;
  color: #666;
}

/* ===== RESPONSIVIDADE ===== */

/* Tablet */
@media (max-width: 1024px) {
  .page {
    margin: 16px;
    padding: 18px;
  }
}

/* Mobile */
@media (max-width: 768px) {

  .grid {
    grid-template-columns: 1fr;
  }

  .sign-grid {
    grid-template-columns: 1fr;
  }

  .doc-title {
    text-align: left;
    margin-top: 10px;
  }

  table {
    font-size: 11px;
  }
}
@media (max-width: 768px) {
  .header {
    flex-direction: column;
  }
}
/* ===== PRINT MODE ===== */
@media print {

  body {
    background: #fff;
  }

  .page {
    box-shadow: none;
    margin: 0;
    border-radius: 0;
    max-width: 100%;
  }
  table {
    page-break-inside: auto;
  }

  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  } 

  thead {
    display: table-header-group;
  }

}
        `}</style>
      </head>

      <body>
        <div className="page">
          {/* HEADER */}
          <div className="header">
            <div className="brand">
              <div className="company">{empresa}</div>
              <div className="sub">
                Unidade: {unidade} • SOC: <b>{treinamento.soc}</b>
              </div>
            </div>

            <div className="doc-title">
              <p className="title">ATA DE TREINAMENTO</p>
              <div className="meta">
                Data do treinamento: <b>{dataTreinamento}</b>
                <br />
                Gerado em: <b>{fmtDateBR(new Date())}</b> às <b>{horaGeracao}</b>
              </div>
            </div>
          </div>

          {/* DADOS DO TREINAMENTO */}
          <div className="section">
            <h2>Dados do Treinamento</h2>
            <div className="grid">
              <div className="field">
                <div className="label">Processo</div>
                <div className="value">{treinamento.processo}</div>
              </div>

              <div className="field">
                <div className="label">Tema</div>
                <div className="value">{treinamento.tema}</div>
              </div>

              <div className="field">
                <div className="label">Instrutor / Líder responsável</div>
                <div className="value">{lider}</div>
              </div>

              <div className="field">
                <div className="label">Status</div>
                <div className="value">{treinamento.status}</div>
              </div>
            </div>

            {!!setores.length && (
              <div style={{ marginTop: 10 }}>
                <div className="label">Setores contemplados</div>
                <div className="chips">
                  {setores.map((s) => (
                    <span key={s} className="chip">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PARTICIPANTES */}
          <div className="section">
            <h2>Lista de Participantes</h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "38%" }}>Nome</th>
                    <th style={{ width: "18%" }}>CPF</th>
                    <th style={{ width: "22%" }}>Setor</th>
                    <th style={{ width: "22%" }}>Assinatura</th>
                  </tr>
                </thead>
                <tbody>
                  {participantes.map((p, idx) => (
                    <tr key={`${p.cpf}-${idx}`}>
                      <td>{p.nome}</td>
                      <td>{p.cpf}</td>
                      <td>{p.setor}</td>
                      <td>
                        <div className="sig" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* OBSERVAÇÕES */}
          <div className="section">
            <h2>Observações</h2>
            <div className="notes">
              {/* espaço para escrita manual */}
            </div>
          </div>

          {/* ASSINATURAS */}
          <div className="section">
            <h2>Assinaturas</h2>
            <div className="sign-grid">
              <div className="sign">
                <div className="who">{lider}</div>
                <div className="role">
                  {instrutorCargo || "Líder / Instrutor responsável"}
                </div>
                <div className="line" />
                <div className="label">Assinatura</div>
              </div>

              <div className="sign">
                <div className="who">HSE / RH / Gestão</div>
                <div className="role">Validação</div>
                <div className="line" />
                <div className="label">Assinatura</div>
              </div>
            </div>
          </div>

          {/* RODAPÉ */}
          <div style={{ marginTop: 14, fontSize: 10, color: "#444" }}>
            Documento interno • Controle de Treinamentos • {empresa}
          </div>
        </div>
      </body>
    </html>
  );
}
