import {
  FileText,
  CheckCircle,
  XCircle,
  Download
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

  return (
    <div className="bg-[#1A1A1C] border border-[#3D3D40] rounded-2xl p-5 flex items-center justify-between">

      {/* ================= INFO ================= */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#2A2A2C] flex items-center justify-center">
          <FileText size={18} />
        </div>

        <div>
          <p className="font-medium">
            {atestado.colaborador?.nomeCompleto || atestado.opsId}
          </p>

          <p className="text-xs text-[#BFBFC3]">
            {formatDateBR(atestado.dataInicio)} →{" "}
            {formatDateBR(atestado.dataFim)} •{" "}
            {atestado.diasAfastamento} dias
          </p>

          {/* INFO EXTRA (opcional / futuro) */}
          {isFinalizado && (
            <p className="text-[11px] text-[#9CA3AF] italic mt-0.5">
              Atestado encerrado
            </p>
          )}
        </div>
      </div>

      {/* ================= AÇÕES ================= */}
      <div className="flex items-center gap-3">

        {/* STATUS */}
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

        {/* DOWNLOAD PDF (sempre permitido se existir) */}
        {onDownload && (
          <Button.IconButton
            onClick={() => onDownload(atestado.idAtestado)}
            title="Download do PDF"
          >
            <Download size={16} />
          </Button.IconButton>
        )}

        {/* AÇÕES DE STATUS (APENAS SE ATIVO) */}
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
  );
}
