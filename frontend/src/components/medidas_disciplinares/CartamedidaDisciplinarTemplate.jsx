import logoShopeeXpress from "../../assets/shopee-xpress-logo.png";

/* =====================================================
   CARTA MEDIDA DISCIPLINAR — TEMPLATE SPX (HTML PRINT A4)
   Modelo atualizado conforme padrão ShopeeXpress
===================================================== */

function fmtDateLong(dateLike) {
  if (!dateLike) return "-";
  const d = new Date(dateLike);
  return d.toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getEstadoFromEstacao(medida) {
  // Tenta extrair o estado da localização da estação ou usa fallback
  const localizacao = medida?.colaborador?.estacao?.localizacao || "";
  // Formato esperado: "Cidade - UF" ou só retorna vazio
  const match = localizacao.match(/[-–]\s*([A-Z]{2})$/);
  if (match) return match[1];
  return medida?.colaborador?.estacao?.nomeEstacao || "";
}

function getCidadeFromEstacao(medida) {
  const localizacao = medida?.colaborador?.estacao?.localizacao || "";
  // Formato esperado: "Cidade - UF"
  const match = localizacao.match(/^(.+?)\s*[-–]/);
  if (match) return match[1].trim();
  return localizacao || "—";
}

export default function CartaMedidaDisciplinarTemplate({ medida }) {
  if (!medida) return null;

  const colaborador = medida.colaborador || {};
  const nomeColaborador = (colaborador.nomeCompleto || "-").toUpperCase();
  const staffId = colaborador.matricula || "-";
  const cidade = getCidadeFromEstacao(medida);
  const estado = getEstadoFromEstacao(medida);
  const dataLong = fmtDateLong(medida.dataAplicacao);

  const tipoMedida = (medida.tipoMedida || "ADVERTENCIA").toUpperCase();
  const tituloCarta =
    tipoMedida.includes("SUSPENSAO") || tipoMedida.includes("SUSPENSÃO")
      ? "CARTA DE SUSPENSÃO"
      : tipoMedida.includes("DEMISSAO") || tipoMedida.includes("DEMISSÃO")
      ? "CARTA DE DEMISSÃO POR JUSTA CAUSA"
      : "CARTA DE ADVERTÊNCIA";

  const acaoVerbo =
    tipoMedida.includes("SUSPENSAO") || tipoMedida.includes("SUSPENSÃO")
      ? "suspenso(a)"
      : tipoMedida.includes("DEMISSAO") || tipoMedida.includes("DEMISSÃO")
      ? "desligado(a) por justa causa"
      : "advertido(a)";

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <title>{`${tituloCarta} — ${nomeColaborador}`}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #fff;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12pt;
            color: #000;
          }
          .page {
            width: 210mm;
            min-height: 297mm;
            margin: auto;
            padding: 20mm 25mm 20mm;
            background: #fff;
            line-height: 1.6;
          }
          .logo {
            margin-bottom: 24px;
            line-height: 1;
          }
          .logo img {
            height: 72px;
            width: auto;
          }
          .date-line {
            font-weight: 700;
            margin-bottom: 24px;
            font-size: 12pt;
          }
          .employee-block {
            margin-bottom: 24px;
          }
          .employee-block p {
            font-weight: 700;
            margin-bottom: 4px;
            font-size: 12pt;
          }
          .main-title {
            text-align: center;
            font-size: 12pt;
            font-weight: 700;
            text-transform: uppercase;
            margin: 28px 0 24px;
          }
          .body-text {
            margin-bottom: 14px;
            text-align: justify;
            font-size: 12pt;
          }
          .sig-section {
            margin-top: 40px;
          }
          .ciente-line {
            margin-bottom: 40px;
            font-size: 12pt;
          }
          .sig-line {
            border-bottom: 1px solid #000;
            width: 260px;
            margin-bottom: 4px;
            margin-top: 40px;
          }
          .sig-name {
            font-weight: 700;
            font-size: 12pt;
          }
          .witnesses {
            margin-top: 48px;
          }
          .witness-block {
            margin-bottom: 32px;
          }
          .witness-label {
            font-weight: 700;
            font-size: 12pt;
            margin-bottom: 32px;
            display: block;
          }
          .witness-line {
            border-bottom: 1px solid #000;
            width: 260px;
            margin-top: 8px;
          }
          @media print {
            body { background: #fff; }
            .page { margin: 0; padding: 15mm 20mm; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">

          {/* LOGO */}
          <div style={{ marginBottom: "24px" }}>
            <img src={logoShopeeXpress} alt="ShopeeXpress" style={{ height: "72px", width: "auto" }} />
          </div>

          {/* DATA E LOCAL */}
          <p className="date-line">
            {cidade}{estado ? `, ${estado}` : ""}{cidade || estado ? ", " : ""}{dataLong}
          </p>

          {/* DADOS DO COLABORADOR */}
          <div className="employee-block">
            <p>NOME COMPLETO: {nomeColaborador}</p>
            <p>STAFF ID: {staffId}</p>
            {estado && <p>Estado: {estado}</p>}
          </div>

          {/* TÍTULO */}
          <div className="main-title">{tituloCarta}</div>

          {/* CORPO */}
          <p className="body-text">
            Pela presente fica V. Sr. {acaoVerbo}, em razão das irregularidades abaixo discriminadas:
          </p>

          <p className="body-text">
            "{medida.motivo || "Nenhum motivo informado."}"
          </p>

          <p className="body-text">
            Lembramos que na reincidência deste comportamento, serão tomadas medidas punitivas mais severas, conforme
            artigo 482 da Consolidação das Leis do Trabalho - CLT.
          </p>

          {/* CIÊNCIA */}
          <div className="sig-section">
            <p className="ciente-line">
              Ciente: ____/____/_____
            </p>

            <div className="sig-line"></div>
            <p className="sig-name">{nomeColaborador}</p>
          </div>

          {/* TESTEMUNHAS */}
          <div className="witnesses">
            <p className="sig-name">Testemunhas</p>

            <div className="witness-block" style={{ marginTop: 8 }}>
              <span className="witness-label">Nome:</span>
              <div className="witness-line"></div>
            </div>

            <div className="witness-block">
              <span className="witness-label">Nome:</span>
              <div className="witness-line"></div>
            </div>
          </div>

        </div>
      </body>
    </html>
  );
}
