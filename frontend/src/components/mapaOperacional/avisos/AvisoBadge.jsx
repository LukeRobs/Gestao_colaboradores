import { OctagonAlert, TriangleAlert } from "lucide-react";
import { corDoAviso, detalheDoAviso, rotuloMotivo } from "./avisosConfig";

/** Selo do aviso (ícone + texto, nunca só cor). */
export function AvisoBadge({ aviso, nomesLabor, className = "" }) {
  const cor = corDoAviso(aviso);
  const Icone = aviso.severidade === "CRITICO" ? OctagonAlert : TriangleAlert;
  return (
    <span
      title={detalheDoAviso(aviso, nomesLabor)}
      className={`inline-flex items-center gap-1 h-6 px-2 rounded-full border text-xs font-semibold whitespace-nowrap ${className}`}
      style={{ color: cor, background: `${cor}1F`, borderColor: `${cor}59` }}
    >
      <Icone size={12} aria-hidden="true" />
      {rotuloMotivo(aviso.motivo)}
    </span>
  );
}
