/* =====================================================
   CARTA MEDIDA DISCIPLINAR — TEMPLATE ADECCO / ADILLIS
   Fiel ao modelo PDF v2 – Revisão 26/08/2025
===================================================== */

function fmtDateLong(dateLike) {
  if (!dateLike) return "-";
  const d = new Date(dateLike);
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDateBR(dateLike) {
  if (!dateLike) return "-";
  return new Date(dateLike).toLocaleDateString("pt-BR");
}

export default function CartaAdeccoTemplate({ medida, nomeEmpresa = "Adecco Recursos Humanos S/A" }) {
  if (!medida) return null;

  const colaborador = medida.colaborador || {};
  const nomeColaborador = colaborador.nomeCompleto || "";
  const cargo = colaborador.cargo || "";
  const matricula = colaborador.matricula || "";
  const operacao = colaborador.estacao?.nomeEstacao || medida.opsId || "";
  const localidade = colaborador.estacao?.localizacao || "Jaboatão dos Guararapes";
  const dataAplicacaoLong = fmtDateLong(medida.dataAplicacao);
  const dataOcorrencia = fmtDateBR(medida.dataOcorrencia);

  const isAdillis = nomeEmpresa.toLowerCase().includes("adilis");
  const logoNome = isAdillis ? "Adillis" : "Adecco";
  const logoSub = isAdillis ? null : "Staffing";
  const nomeAssinatura = isAdillis ? nomeEmpresa : "Adecco Recursos Humanos S/A";

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="UTF-8" />
        <title>Advertência Disciplinar</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #fff;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            color: #111;
          }
          .page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 16mm 22mm 20mm 22mm;
            background: #fff;
            line-height: 1.6;
            position: relative;
          }

          /* HEADER */
          .header {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 26px;
          }
          .logo-nome {
            font-size: 28pt;
            font-weight: 900;
            color: #c8102e;
            line-height: 1;
            letter-spacing: -1px;
            text-align: right;
          }
          .logo-sub {
            font-size: 9pt;
            color: #c8102e;
            letter-spacing: 3px;
            text-align: right;
            margin-top: 0px;
          }

          /* DATA */
          .date-line {
            font-weight: 700;
            margin-bottom: 22px;
          }

          /* TÍTULO */
          .doc-title {
            text-align: center;
            font-size: 13pt;
            font-weight: 700;
            margin-bottom: 20px;
          }

          /* CAMPOS */
          .fields { margin-bottom: 18px; }
          .fields p { margin-bottom: 3px; }
          .field-nome {
            display: inline-flex;
            align-items: baseline;
            gap: 4px;
          }
          .nome-underline {
            display: inline-block;
            border-bottom: 1px solid #111;
            min-width: 180px;
          }

          /* CORPO */
          .body-text { margin-bottom: 13px; text-align: justify; }
          .body-bold  { margin-bottom: 13px; text-align: justify; font-weight: 700; }

          /* ASSINATURAS */
          .sig-area { margin-top: 52px; }

          .sig-center-wrap {
            display: flex;
            justify-content: center;
            margin-bottom: 38px;
          }
          .sig-center-inner { width: 55%; }
          .sig-line { border-bottom: 1px solid #111; margin-bottom: 3px; }
          .sig-name { font-size: 10pt; text-align: center; }

          .sig-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 28px;
            margin-bottom: 32px;
          }
          .sig-col-label { font-size: 10pt; text-align: center; margin-top: 3px; }

          /* TESTEMUNHAS */
          .witness-block { margin-bottom: 20px; }
          .witness-row {
            display: flex;
            align-items: flex-end;
            gap: 6px;
          }
          .witness-label { white-space: nowrap; }
          .witness-blank {
            flex: 1;
            border-bottom: 1px solid #111;
            margin-bottom: 1px;
          }
          .witness-sub {
            font-size: 9pt;
            color: #444;
            text-align: center;
            margin-top: 3px;
          }

          /* RODAPÉ */
          .footer {
            position: absolute;
            bottom: 10mm;
            right: 22mm;
            font-size: 8pt;
            color: #888;
          }

          @media print {
            body { background: #fff; }
            .page { margin: 0; box-shadow: none; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">

          {/* LOGO — canto superior direito */}
          <div className="header">
            <div>
              <div className="logo-nome">{logoNome}</div>
              {logoSub && <div className="logo-sub">{logoSub}</div>}
            </div>
          </div>

          {/* DATA E LOCAL */}
          <p className="date-line">{localidade}, {dataAplicacaoLong}.</p>

          {/* TÍTULO */}
          <div className="doc-title">Advertência Disciplinar</div>

          {/* CAMPOS — exatamente como no PDF */}
          <div className="fields">
            <p>
              <strong>Nome:</strong>{" "}
              <span className="nome-underline">{nomeColaborador}</span>
            </p>
            <p><strong>Cargo:</strong> {cargo}</p>
            <p><strong>Matrícula/Registro:</strong> {matricula}</p>
            <p><strong>Operação:</strong> {operacao}</p>
          </div>

          {/* PARÁGRAFO 1 */}
          <p className="body-text">
            Através deste documento, comunicamos formalmente ao(à) colaborador(a) acima identificado(a)
            que está sendo <strong>advertido(a)</strong> em razão do seguinte fato:
          </p>

          {/* MOTIVO — negrito */}
          <p className="body-bold">
            Em razão de sua ausência na(s) data(s) {dataOcorrencia}, sem justificativa plausível ou legal para abonar o dia referido.
          </p>

          {/* CLT */}
          <p className="body-text">
            Tal conduta infringe as normas internas da empresa e/ou disposições legais previstas na
            Consolidação das Leis do Trabalho (CLT), sendo incompatível com as expectativas e o padrão de
            comportamento esperado no ambiente de trabalho.
          </p>

          {/* DISCIPLINAR */}
          <p className="body-text">
            Esta advertência tem caráter <strong>disciplinar</strong> e visa orientar o colaborador para que não volte a incorrer
            nas mesmas práticas.
          </p>

          {/* REINCIDÊNCIA */}
          <p className="body-text">
            Em caso de reincidência, poderão ser aplicadas medidas disciplinares mais severas, como{" "}
            <strong>suspensão</strong> ou até <strong>rescisão contratual por justa causa</strong>, conforme previsto em lei.
          </p>

          {/* ASSINATURAS */}
          <div className="sig-area">

            {/* COLABORADOR — linha centralizada */}
            <div className="sig-center-wrap">
              <div className="sig-center-inner">
                <div className="sig-line"></div>
                <div className="sig-name">{nomeColaborador}</div>
              </div>
            </div>

            {/* GESTÃO DIRETA | EMPRESA */}
            <div className="sig-grid">
              <div>
                <div className="sig-line"></div>
                <div className="sig-col-label">Gestão Direta</div>
              </div>
              <div>
                <div className="sig-line"></div>
                <div className="sig-col-label">{nomeAssinatura}</div>
              </div>
            </div>

            {/* TESTEMUNHA 1 */}
            <div className="witness-block">
              <div className="witness-row">
                <span className="witness-label">Testemunha 1:</span>
                <span className="witness-blank"></span>
              </div>
              <div className="witness-sub">Nome por extenso / R.G.</div>
            </div>

            {/* TESTEMUNHA 2 */}
            <div className="witness-block">
              <div className="witness-row">
                <span className="witness-label">Testemunha 2:</span>
                <span className="witness-blank"></span>
              </div>
              <div className="witness-sub">Nome por extenso / R.G.</div>
            </div>

          </div>

          {/* RODAPÉ */}
          <div className="footer">V2 – Revisão 26/08/2025</div>

        </div>
      </body>
    </html>
  );
}
