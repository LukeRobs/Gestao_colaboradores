import {
  FileText,
  Calendar,
  Clock,
  Download,
  CheckCircle,
  XCircle,
  FileWarning
} from "lucide-react";

import { Badge, Button } from "./UIComponents";
import { formatDateBR } from "../utils/date";

export default function AtestadoCard({
  atestado,
  onFinalizar,
  onCancelar,
  onDownload,
}) {
  const isAtivo = atestado.status === "ATIVO";
  const isFinalizado = atestado.status === "FINALIZADO";
  const isCancelado = atestado.status === "CANCELADO";

  const diasLabel =
    atestado.diasAfastamento === 1
      ? "1 DIA"
      : `${atestado.diasAfastamento} DIAS`;

  const statusColor = isAtivo
    ? "border-l-yellow-500"
    : isFinalizado
    ? "border-l-green-500"
    : "border-l-red-500";

  return (
    <div
      className={`
        bg-[#161618]
        border border-[#2C2C2F]
        border-l-4 ${statusColor}
        rounded-2xl
        p-4 sm:p-5 lg:p-6
        space-y-5
        hover:border-default
        transition-all
      `}
    >
      {/* ================= HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        
        {/* BLOCO ESQUERDO */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
            <FileText size={20} className="text-orange-400" />
          </div>

          <div className="min-w-0">
            <p className="text-sm sm:text-base font-semibold text-white truncate">
              {atestado.colaborador?.nomeCompleto || atestado.opsId}
            </p>

            <p className="text-xs text-[#9CA3AF] mt-1 truncate">
              OPS ID: {atestado.opsId}
            </p>
          </div>
        </div>

        <div className="self-start sm:self-auto">
          <Badge.Status
            variant={
              isAtivo
                ? "warning"
                : isFinalizado
                ? "success"
                : "danger"
            }
          >
            {atestado.status}
          </Badge.Status>
        </div>
      </div>

      {/* ================= PERÍODO ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#0E0E0F] border border-[#2C2C2F] rounded-xl p-3 sm:p-4">
        
        <div className="flex items-center gap-3 text-xs sm:text-sm text-white">
          <Calendar size={15} className="text-muted" />
          <span className="wrap-break-words">
            {formatDateBR(atestado.dataInicio)} →{" "}
            {formatDateBR(atestado.dataFim)}
          </span>
        </div>

        <div className="flex items-center gap-2 bg-[#1F1F22] px-3 py-1 rounded-lg text-[11px] sm:text-xs font-semibold tracking-wide text-white w-fit">
          <Clock size={14} className="text-[#9CA3AF]" />
          {diasLabel}
        </div>
      </div>

      {/* ================= CID ================= */}
      {atestado.cid && (
        <div className="flex items-center gap-2 text-xs sm:text-sm text-[#E5E7EB]">
          <FileWarning size={15} className="text-[#9CA3AF]" />
          <span className="wrap-break-words">
            <span className="text-white/80 font-medium">CID:</span>{" "}
            {atestado.cid}
          </span>
        </div>
      )}

      {/* ================= OBSERVAÇÕES ================= */}
      {atestado.observacao && (
        <div className="bg-[#0F0F10] border border-[#2C2C2F] rounded-xl p-3 sm:p-4">
          <p className="text-[10px] uppercase text-[#9CA3AF] tracking-wider mb-2">
            Observações
          </p>

          <p className="text-xs sm:text-sm text-white/90 leading-relaxed line-clamp-4">
            {atestado.observacao}
          </p>
        </div>
      )}

      {/* ================= FOOTER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-[#2C2C2F]">
        
        <div className="text-[11px] sm:text-xs text-[#9CA3AF]">
          {isFinalizado && "Atestado Finalizado"}
          {isCancelado && "Atestado cancelado"}
          {isAtivo && "Atestado Ativo"}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {onDownload && (
            <Button.IconButton
              onClick={() => onDownload(atestado.idAtestado)}
              title="Download do PDF"
            >
              <Download size={16} />
            </Button.IconButton>
          )}

          {isAtivo && (
            <>
              <Button.IconButton
                variant="success"
                onClick={() => onFinalizar(atestado.idAtestado)}
                title="Finalizar atestado"
              >
                <CheckCircle size={16} />
              </Button.IconButton>

              <Button.IconButton
                variant="danger"
                onClick={() => onCancelar(atestado.idAtestado)}
                title="Cancelar atestado"
              >
                <XCircle size={16} />
              </Button.IconButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}