import {
  FileText,
  CheckCircle,
  XCircle,
  Download
} from "lucide-react";
import { Badge, Button } from "./UIComponents";

export default function AtestadoCard({
  atestado,
  onFinalizar,
  onCancelar,
  onDownload,
}) {
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
            {new Date(atestado.dataInicio).toLocaleDateString()} →{" "}
            {new Date(atestado.dataFim).toLocaleDateString()} •{" "}
            {atestado.diasAfastamento} dias
          </p>
        </div>
      </div>

      {/* ================= AÇÕES ================= */}
      <div className="flex items-center gap-3">
        
        {/* STATUS */}
        <Badge.Status
          variant={
            atestado.status === "ATIVO"
              ? "warning"
              : atestado.status === "FINALIZADO"
              ? "success"
              : "danger"
          }
        >
          {atestado.status}
        </Badge.Status>

        {/* DOWNLOAD PDF */}
        {onDownload && (
          <Button.IconButton
            onClick={() => onDownload(atestado)}
            title="Download do PDF"
          >
            <Download size={16} />
          </Button.IconButton>
        )}

        {/* AÇÕES DE STATUS */}
        {atestado.status === "ATIVO" && (
          <>
            <Button.IconButton
              variant="success"
              onClick={() => onFinalizar(atestado)}
              title="Finalizar atestado"
            >
              <CheckCircle size={16} />
            </Button.IconButton>

            <Button.IconButton
              variant="danger"
              onClick={() => onCancelar(atestado)}
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
