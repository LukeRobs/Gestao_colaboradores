// src/components/AcidenteCard.jsx
import { AlertTriangle, Camera, MapPin, Calendar } from "lucide-react";

export default function AcidenteCard({ acidente }) {
  const dt = acidente.dataOcorrencia
    ? new Date(acidente.dataOcorrencia).toLocaleDateString("pt-BR")
    : "-";

  // horarioOcorrencia vem como "HH:mm"
  const hora = acidente.horarioOcorrencia
    ? acidente.horarioOcorrencia.slice(0, 5)
    : "-";

  const nome = acidente.colaborador?.nomeCompleto || "-";
  const fotosCount = acidente.evidencias?.length || 0;

  // alinhado com backend (nomeRegistrante)
  const registradoPor =
    acidente.nomeRegistrante ||
    acidente.registradoPor ||
    "Sistema";

  return (
    <div className="bg-[#1A1A1C] border border-[#3D3D40] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#2A2A2C] flex items-center justify-center">
            <AlertTriangle size={18} />
          </div>

          <div>
            <p className="font-medium text-white">{nome}</p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#BFBFC3] mt-1">
              <span className="inline-flex items-center gap-1">
                <Calendar size={14} /> {dt} • {hora}
              </span>

              <span className="inline-flex items-center gap-1">
                <MapPin size={14} /> {acidente.localOcorrencia || "-"}
              </span>

              <span className="inline-flex items-center gap-1">
                <Camera size={14} /> {fotosCount} foto{fotosCount !== 1 ? "s" : ""}
              </span>
            </div>

            <p className="text-xs text-[#BFBFC3] mt-2">
              <span className="text-white/90">Tipo:</span>{" "}
              {acidente.tipoOcorrencia || "-"}{" "}
              <span className="text-white/90">• Integração:</span>{" "}
              {acidente.participouIntegracao ? "Sim" : "Não"}
            </p>
          </div>
        </div>

        <div className="text-xs text-[#BFBFC3] text-right">
          <p className="uppercase">Registrado por</p>
          <p className="text-white/90 font-medium">
            {registradoPor}
          </p>
        </div>
      </div>

      {/* RESUMO */}
      <div className="mt-4 bg-[#0D0D0D] border border-[#3D3D40] rounded-xl p-4">
        <p className="text-xs uppercase text-[#BFBFC3]">
          Descrição / Ações imediatas
        </p>
        <p className="text-sm text-white mt-1 line-clamp-3">
          {acidente.acoesImediatas || "-"}
        </p>
      </div>
    </div>
  );
}
