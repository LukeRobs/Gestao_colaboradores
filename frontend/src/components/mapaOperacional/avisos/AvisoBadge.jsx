import { detalheDoAviso, gravidadeDe, motivoDe } from "./avisosConfig";

/**
 * Selo cheio do aviso: ícone do tipo + texto (nunca só cor). Crítico pulsa de leve (respeita reduced-motion).
 * `compacto` mostra só o ícone num círculo (cards apertados), com o texto no tooltip e no leitor de tela.
 */
export function AvisoBadge({ aviso, nomesLabor, compacto = false, className = "" }) {
  const g = gravidadeDe(aviso);
  const { Icone, label } = motivoDe(aviso.motivo);
  const detalhe = detalheDoAviso(aviso, nomesLabor);
  const pulsa = aviso.severidade === "CRITICO" ? "motion-safe:animate-pulse" : "";

  if (compacto) {
    return (
      <span
        title={detalhe}
        role="img"
        aria-label={detalhe}
        className={`inline-grid place-items-center h-7 w-7 rounded-full shrink-0 shadow-sm ${pulsa} ${className}`}
        style={{ background: g.fundo, color: g.texto }}
      >
        <Icone size={15} strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      title={detalhe}
      className={`inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm ${pulsa} ${className}`}
      style={{ background: g.fundo, color: g.texto }}
    >
      <Icone size={14} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </span>
  );
}
