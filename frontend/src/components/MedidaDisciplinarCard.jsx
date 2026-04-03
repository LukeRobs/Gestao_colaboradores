import { FileText, Download, Calendar, User, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MedidasDisciplinaresAPI } from "../services/medidasDisciplinares";

export default function MedidaDisciplinarCard({ medida }) {

  const navigate = useNavigate();

  /* ================= DOWNLOAD ================= */

  async function handleDownload(e) {

    e.stopPropagation();

    try {

      const res = await MedidasDisciplinaresAPI.presignDownload(
        medida.idMedida
      );

      const url = res?.data?.data?.url;

      if (!url) {
        alert("Documento não disponível");
        return;
      }

      window.open(url, "_blank");

    } catch (err) {

      console.error(err);
      alert("Erro ao baixar documento");

    }

  }

  /* ================= ABRIR DETALHE ================= */

  function abrirMedida() {
    navigate(`/medidas-disciplinares/${medida.idMedida}`);
  }

  /* ================= CORES ================= */

  const tipo = (medida.tipoMedida || "").toLowerCase();

  const tipoColor =
    tipo.includes("advert")
      ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
      : tipo.includes("susp")
      ? "bg-red-500/15 text-red-400 border-red-500/30"
      : "bg-[#FA4C00]/15 text-[#FA4C00] border-[#FA4C00]/30";

  const statusColor =
    medida.status === "ASSINADO"
      ? "bg-green-500/15 text-green-400 border-green-500/30"
      : medida.status === "PENDENTE_ASSINATURA"
      ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
      : "bg-gray-500/15 text-gray-400 border-gray-500/30";

  const dataAplicacao = medida.dataAplicacao
    ? new Date(medida.dataAplicacao).toLocaleDateString("pt-BR")
    : "-";

  return (

    <div
      onClick={abrirMedida}
      className="
        relative
        cursor-pointer
        bg-[#141416]
        border border-[#2A2A2D]
        rounded-2xl
        p-4 sm:p-6
        transition-all
        hover:border-[#FA4C00]/40
        hover:shadow-lg
        hover:shadow-[#FA4C00]/5
      "
    >

      {/* BARRA LATERAL */}

      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-[#FA4C00]" />

      {/* HEADER */}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">

        <div className="flex items-start gap-3 sm:gap-4 min-w-0">

          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#1F1F22] flex items-center justify-center shrink-0">
            <FileText size={18} className="text-[#FA4C00]" />
          </div>

          <div className="min-w-0">

            <p className="text-sm sm:text-base font-semibold text-white truncate">
              {medida.colaborador?.nomeCompleto || "-"}
            </p>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#8B8B90] mt-2">

              <div className="flex items-center gap-1 truncate">
                <User size={12} />
                {medida.opsId || "-"}
              </div>

              <div className="flex items-center gap-1">
                <Calendar size={12} className="text-white" />
                {dataAplicacao}
              </div>

            </div>

          </div>

        </div>

        {/* BADGES */}

        <div className="flex gap-2 flex-wrap">

          <div
            className={`
              px-3 py-1
              text-xs
              rounded-full
              border
              font-medium
              ${tipoColor}
            `}
          >
            {medida.tipoMedida || "-"}
          </div>

          <div
            className={`
              px-3 py-1
              text-xs
              rounded-full
              border
              font-medium
              ${statusColor}
            `}
          >
            {medida.status || "-"}
          </div>

        </div>

      </div>

      {/* MOTIVO */}

      <div className="mt-6">

        <p className="text-sm text-[#BFBFC3] leading-relaxed line-clamp-4">
          {medida.motivo || "Gerado automaticamente pelo sistema"}
        </p>

      </div>

      {/* FOOTER */}

      <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-3">

        {/* BOTÃO UPLOAD */}

        {medida.status === "PENDENTE_ASSINATURA" && (

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/medidas-disciplinares/${medida.idMedida}`);
            }}
            className="
              w-full sm:w-auto
              flex items-center justify-center gap-2
              px-4 py-2
              rounded-xl
              text-sm
              bg-yellow-500/15
              border border-yellow-500/30
              text-yellow-400
              hover:bg-yellow-500/20
            "
          >
            <Upload size={14} />
            Enviar PDF
          </button>

        )}

        {/* BOTÃO DOWNLOAD */}

        {medida.status === "ASSINADO" && (

          <button
            onClick={handleDownload}
            className="
              w-full sm:w-auto
              flex items-center justify-center gap-2
              px-4 py-2
              rounded-xl
              text-sm
              bg-[#1F1F22]
              border border-[#2A2A2D]
              hover:border-[#FA4C00]/50
              hover:bg-[#1A1A1C]
              transition-all
            "
          >
            <Download size={14} />
            Baixar PDF
          </button>

        )}

      </div>

    </div>

  );

}