import { formatNumero } from "../../components/mapaOperacional/uiTokens";
import { fmtHora } from "./filaUtils";

// Peças visuais compartilhadas pelas telas Fila de veículos e Veículos recebidos.

export function Pilula({ cor, icone, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap" style={{ color: cor, background: `${cor}1A`, borderColor: `${cor}40` }}>
      {icone} {children}
    </span>
  );
}

export function Campo({ rotulo, children, mono }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{rotulo}</dt>
      <dd className={`mt-0.5 text-sm font-medium ${mono ? "tabular-nums" : ""}`}>{children || "—"}</dd>
    </div>
  );
}

export function BlocoEstacao({ titulo, e, carga }) {
  return (
    <div className="rounded-xl border border-default bg-surface-2 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted">{titulo}</p>
      <p className="mt-0.5 text-sm font-semibold break-words">{e?.nome || "—"}</p>
      {e && (
        <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div><dt className="text-muted">Chegada</dt><dd className="font-medium tabular-nums">{fmtHora(e.ata)}</dd></div>
          <div><dt className="text-muted">Saída</dt><dd className="font-medium tabular-nums">{fmtHora(e.atd)}</dd></div>
          <div><dt className="text-muted">{carga.rotulo}</dt><dd className="font-medium tabular-nums">{formatNumero(carga.valor)}</dd></div>
        </dl>
      )}
    </div>
  );
}

const TIPOS_CARGA = ["Saca", "Scuttle", "Volumoso"];

/** Composição da carga por tipo (Saca, Scuttle, Volumoso…). Não desenha nada sem dados. */
export function ComposicaoCarga({ comp }) {
  if (!comp) return null;
  const tipos = [...new Set([...TIPOS_CARGA, ...Object.keys(comp.porTipo || {})])].filter((t) => comp.porTipo?.[t]);
  if (tipos.length === 0) return null;
  return (
    <section aria-label="Composição da carga">
      <h3 className="text-xs uppercase tracking-wide text-muted mb-2">Composição da carga · {formatNumero(comp.total)} TOs</h3>
      <ul className="space-y-2">
        {tipos.map((t) => {
          const q = comp.porTipo[t];
          const pct = comp.total ? Math.round((q / comp.total) * 100) : 0;
          return (
            <li key={t} className="flex items-center gap-3 text-xs">
              <span className="w-20 shrink-0 text-muted">{t}</span>
              <div className="flex-1 h-1.5 rounded bg-surface-2 overflow-hidden">
                <div className="h-full rounded bg-[#FA4C00]" style={{ width: `${Math.max(3, pct)}%` }} />
              </div>
              <span className="w-20 text-right tabular-nums font-semibold">{formatNumero(q)} · {pct}%</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const OPCOES_POR_PAGINA = [10, 25, 50];

// Janela de páginas: 1 … (atual-1) atual (atual+1) … última
function paginasVisiveis(atual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const meio = [atual - 1, atual, atual + 1].filter((p) => p > 1 && p < total);
  const itens = [1];
  if (meio[0] > 2) itens.push("…a");
  itens.push(...meio);
  if (meio[meio.length - 1] < total - 1) itens.push("…b");
  itens.push(total);
  return itens;
}

/** Barra de paginação: "Mostrando X–Y de N", páginas e "Por página". `pagina` começa em 1. */
export function Paginacao({ total, pagina, porPagina, onPagina, onPorPagina, opcoes = OPCOES_POR_PAGINA }) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const de = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ate = Math.min(pagina * porPagina, total);
  const botao = "min-w-9 h-9 px-2 grid place-items-center rounded-lg text-sm font-medium tabular-nums cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FA4C00]";

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-default">
      <p className="text-sm text-muted tabular-nums" aria-live="polite">
        Mostrando <b className="text-page">{de}–{ate}</b> de <b className="text-page">{total}</b>
      </p>

      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPagina(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior" className={`${botao} text-muted hover:text-page hover:bg-surface-2 ${foco}`}>
          ‹
        </button>
        {paginasVisiveis(pagina, totalPaginas).map((p) =>
          typeof p === "string" ? (
            <span key={p} aria-hidden="true" className="px-1 text-muted">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPagina(p)}
              aria-label={`Página ${p}`}
              aria-current={p === pagina ? "page" : undefined}
              className={`${botao} ${foco} ${p === pagina ? "bg-[#FA4C00] text-white" : "text-muted hover:text-page hover:bg-surface-2"}`}
            >
              {p}
            </button>
          )
        )}
        <button type="button" onClick={() => onPagina(pagina + 1)} disabled={pagina >= totalPaginas} aria-label="Próxima página" className={`${botao} text-muted hover:text-page hover:bg-surface-2 ${foco}`}>
          ›
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted">
        Por página
        <select
          value={porPagina}
          onChange={(e) => onPorPagina(Number(e.target.value))}
          className="h-9 rounded-lg bg-surface-2 border border-default px-2 text-sm text-page cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FA4C00]"
        >
          {opcoes.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
    </nav>
  );
}
