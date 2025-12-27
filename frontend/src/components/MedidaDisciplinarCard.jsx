import { FileText, Download } from "lucide-react";
import { Badge, Button } from "./UIComponents";
import { MedidasDisciplinaresAPI } from "../services/medidasDisciplinares";

export default function MedidaDisciplinarCard({ medida }) {
  async function handleDownload() {
    const res = await MedidasDisciplinaresAPI.presignDownload(medida.idMedida);
    window.open(res.data.data.url, "_blank");
  }

  return (
    <div className="bg-[#1A1A1C] border border-[#3D3D40] rounded-xl p-5 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-semibold">
            {medida.colaborador?.nomeCompleto}
          </p>
          <p className="text-xs text-[#BFBFC3]">
            OPS ID: {medida.opsId}
          </p>
        </div>

        <Badge.Status variant="warning">
          {medida.tipoMedida}
        </Badge.Status>
      </div>

      <div className="text-sm">
        <p>
          <strong>Data:</strong>{" "}
          {new Date(medida.dataAplicacao).toLocaleDateString()}
        </p>
        <p className="text-[#BFBFC3] mt-1">
          {medida.motivo}
        </p>
      </div>

      <div className="flex justify-end">
        <Button.Secondary onClick={handleDownload} icon={<Download size={14} />}>
          PDF
        </Button.Secondary>
      </div>
    </div>
  );
}
