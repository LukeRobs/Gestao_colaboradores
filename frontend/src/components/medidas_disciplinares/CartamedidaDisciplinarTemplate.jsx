/* =====================================================
   CARTA MEDIDA DISCIPLINAR — TEMPLATE (HTML PRINT A4)
===================================================== */

function fmtDateBR(dateLike) {
  if (!dateLike) return "-";
  const d = new Date(dateLike);
  return d.toLocaleDateString("pt-BR");
}

function fmtDateLong(dateLike) {
  if (!dateLike) return "-";
  const d = new Date(dateLike);
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function normalizeCpf(cpf) {
  const v = String(cpf || "").replace(/\D/g, "");
  if (v.length !== 11) return cpf || "-";
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function getTipoAcao(tipoMedida) {
  const t = (tipoMedida || "").toLowerCase();
  if (t.includes("suspensão") || t.includes("suspensao")) return "suspenso(a)";
  if (t.includes("demissão") || t.includes("demissao")) return "desligado(a)";
  return "advertido(a)";
}

export default function CartaMedidaDisciplinarTemplate({
  medida,
  empresa = "SPX Express",
  unidade = "Operações",
}) {
  if (!medida) return null;

  const dataAplicacaoLong = fmtDateLong(medida.dataAplicacao);
  const dataOcorrencia = fmtDateBR(medida.dataOcorrencia);

  const colaborador = medida.colaborador || {};
  const nomeColaborador = colaborador.nomeCompleto || "-";
  const cpfColaborador = normalizeCpf(colaborador.cpf);
  const matricula = colaborador.matricula || "-";
  const cargo = colaborador.cargo || "-";

  const tipoMedida = medida.tipoMedida || "Advertência";
  const tipoTitulo = tipoMedida.toUpperCase();
  const tipoAcao = getTipoAcao(tipoMedida);

  return (
    <div className="page">
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .page {
          width: 210mm;
          min-height: 297mm;
          margin: auto;
          padding: 18mm 22mm 16mm;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12px;
          color: #111;
          background: #fff;
          line-height: 1.55;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #FA4C00;
          padding-bottom: 8px;
          margin-bottom: 14px;
        }
        .company { font-size: 17px; font-weight: 700; color: #FA4C00; }
        .doc-info { text-align: right; }
        .doc-title { font-size: 13px; font-weight: 700; color: #FA4C00; }
        .doc-meta { font-size: 10px; color: #666; margin-top: 2px; }
        .date-line { text-align: right; margin-bottom: 12px; }
        .employee-block { margin-bottom: 12px; }
        .employee-block p { margin-bottom: 3px; }
        .main-title {
          text-align: center;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          text-decoration: underline;
          margin: 12px 0 10px;
        }
        .body-text { margin-bottom: 8px; text-align: justify; }
        .details-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 20px;
          margin: 8px 0;
          font-size: 11px;
        }
        .detail-label { color: #555; }
        .detail-value { font-weight: 700; }
        .motivo-block {
          border-left: 3px solid #FA4C00;
          padding: 7px 10px;
          margin: 8px 0;
          background: #FFFAF8;
          font-style: italic;
          text-align: justify;
        }
        .alert-text { margin: 10px 0; font-weight: 700; text-align: justify; }
        .divider { border: none; border-top: 1px solid #ddd; margin: 14px 0; }
        .sig-section { margin-top: 14px; }
        .sig-section p { margin-bottom: 4px; font-size: 11px; color: #444; }
        .sig-line {
          border-bottom: 1px solid #111;
          margin: 22px 0 3px;
        }
        .sig-label { font-size: 11px; color: #444; }
        .sig-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 10px;
        }
        .ciente-line {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-top: 14px;
          font-size: 12px;
        }
        .ciente-blank {
          display: inline-block;
          border-bottom: 1px solid #111;
          width: 50px;
        }
        .footer {
          margin-top: 16px;
          font-size: 9px;
          color: #999;
          text-align: center;
          border-top: 1px solid #e5e7eb;
          padding-top: 5px;
        }
        @media print {
          body { background: #fff; }
          .page { margin: 0; box-shadow: none; }
        }
      `}</style>

      {/* HEADER */}
      <div className="header">
        <div className="company">{empresa}</div>
        <div className="doc-info">
          <div className="doc-title">CARTA DE {tipoTitulo}</div>
          <div className="doc-meta">Nº {medida.idMedida} · Emitida em: {fmtDateBR(new Date())}</div>
        </div>
      </div>

      {/* DATA E LOCAL */}
      <div className="date-line">
        {unidade}, {dataAplicacaoLong}
      </div>

      {/* DADOS DO COLABORADOR */}
      <div className="employee-block">
        <p><strong>NOME COMPLETO:</strong> {nomeColaborador}</p>
        <p><strong>STAFF ID:</strong> {matricula} &nbsp;|&nbsp; <strong>CPF:</strong> {cpfColaborador}</p>
        <p><strong>Cargo:</strong> {cargo}</p>
      </div>

      {/* TÍTULO */}
      <div className="main-title">CARTA DE {tipoTitulo}</div>

      {/* INTRO */}
      <p className="body-text">
        Pela presente fica V. Sr(a). <strong>{tipoAcao}</strong>, em razão das irregularidades abaixo discriminadas:
      </p>

      {/* DETALHES DA MEDIDA */}
      <div className="details-row">
        {medida.violacao && (
          <span>
            <span className="detail-label">Violação: </span>
            <span className="detail-value">{medida.violacao}</span>
          </span>
        )}
        {medida.nivelViolacao && (
          <span>
            <span className="detail-label">Nível: </span>
            <span className="detail-value">{medida.nivelViolacao}</span>
          </span>
        )}
        <span>
          <span className="detail-label">Data da ocorrência: </span>
          <span className="detail-value">{dataOcorrencia}</span>
        </span>
        {medida.opsId && (
          <span>
            <span className="detail-label">OPS ID: </span>
            <span className="detail-value">{medida.opsId}</span>
          </span>
        )}
        {medida.diasSuspensao && (
          <span>
            <span className="detail-label">Dias de suspensão: </span>
            <span className="detail-value">{medida.diasSuspensao}</span>
          </span>
        )}
      </div>

      {/* MOTIVO */}
      <div className="motivo-block">
        {medida.motivo || "Nenhum motivo informado."}
      </div>

      {/* CLT */}
      <p className="alert-text">
        Lembramos que na reincidência deste comportamento, serão tomadas medidas
        punitivas mais severas, conforme artigo 482 da Consolidação das Leis do
        Trabalho - CLT.
      </p>

      <hr className="divider" />

      {/* CIÊNCIA DO COLABORADOR */}
      <div className="sig-section">
        <div className="ciente-line">
          <span>Ciente:</span>
          <span className="ciente-blank"></span>
          <span>/</span>
          <span className="ciente-blank"></span>
          <span>/</span>
          <span className="ciente-blank" style={{ width: 60 }}></span>
        </div>
        <div style={{ marginTop: 4 }}>
          <div className="sig-line"></div>
          <div className="sig-label">{nomeColaborador}</div>
        </div>
      </div>

      {/* TESTEMUNHAS */}
      <div className="sig-section" style={{ marginTop: 12 }}>
        <p>
          <strong>Testemunhas</strong>{" "}
          <span style={{ fontStyle: "italic" }}>
            (caso o colaborador se recuse a assinar)
          </span>
        </p>
        <div className="sig-grid">
          <div>
            <div className="sig-line"></div>
            <div className="sig-label">Nome e assinatura</div>
          </div>
          <div>
            <div className="sig-line"></div>
            <div className="sig-label">Nome e assinatura</div>
          </div>
        </div>
      </div>

      {/* VALIDAÇÕES */}
      <div className="sig-grid" style={{ marginTop: 14 }}>
        <div>
          <div className="sig-line"></div>
          <div className="sig-label">Gestor Imediato / Supervisor</div>
        </div>
        <div>
          <div className="sig-line"></div>
          <div className="sig-label">RH / Gestão de Pessoas</div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="footer">
        Documento interno · Controle de Medidas Disciplinares · {empresa}
      </div>
    </div>
  );
}
