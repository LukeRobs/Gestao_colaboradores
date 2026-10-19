// Peças de interface da Previsão de recebimento: cards de indicador, barras de composição e cartão de gráfico.

/** Barra segmentada (ex.: pendentes por situação). Sem total vira uma trilha vazia. */
export function BarraSegmentada({ segmentos, rotulo }) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0);
  return (
    <div role="img" aria-label={rotulo} className="flex h-1.5 w-full gap-0.5 rounded-full overflow-hidden bg-surface-2">
      {total > 0 &&
        segmentos
          .filter((s) => s.valor > 0)
          .map((s) => (
            <span key={s.rotulo} title={`${s.rotulo}: ${s.valor}`} className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(s.valor / total) * 100}%`, background: s.cor }} />
          ))}
    </div>
  );
}

/** Card de indicador: ícone num chip colorido, valor grande, apoio e (opcional) uma barra embaixo. */
export function Kpi({ icone, rotulo, valor, apoio, tom = "#FA4C00", corValor, barra, indice = 0 }) {
  return (
    <div className="anim-in group rounded-2xl border border-default bg-surface p-4 flex flex-col gap-3 transition-colors hover:border-default-2" style={{ "--i": indice }}>
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="grid place-items-center w-8 h-8 rounded-xl shrink-0" style={{ background: `${tom}22`, color: tom }}>
          {icone}
        </span>
        <p className="text-xs font-medium text-muted leading-tight">{rotulo}</p>
      </div>
      <div>
        <p className="text-[1.75rem] leading-none font-semibold tabular-nums tracking-tight" style={corValor ? { color: corValor } : undefined}>
          {valor}
        </p>
        {apoio && <p className="mt-1.5 text-xs text-muted leading-snug">{apoio}</p>}
      </div>
      {barra && <div className="mt-auto pt-0.5">{barra}</div>}
    </div>
  );
}

/**
 * Card de destaque (o número principal da tela): ícone, valor bem grande, apoio e uma linha de indicadores
 * secundários embaixo. `extras`: [{ icone, rotulo, valor }].
 */
export function KpiDestaque({ icone, rotulo, valor, apoio, aviso, extras, indice = 0, className = "" }) {
  return (
    <div className={`anim-in relative overflow-hidden rounded-2xl border border-[#FA4C00]/30 bg-surface p-5 sm:p-6 flex flex-col ${className}`} style={{ "--i": indice }}>
      <div aria-hidden="true" className="pointer-events-none absolute -top-28 -right-24 h-72 w-72 rounded-full bg-[#FA4C00]/15 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <span aria-hidden="true" className="grid place-items-center w-10 h-10 rounded-xl bg-[#FA4C00]/15 text-[#FA4C00] shrink-0">
          {icone}
        </span>
        <p className="text-sm font-medium text-muted">{rotulo}</p>
      </div>
      <p className="relative mt-5 text-5xl sm:text-6xl leading-none font-semibold tabular-nums tracking-tight">{valor}</p>
      {apoio && <p className="relative mt-3 text-sm text-muted">{apoio}</p>}
      {aviso && <p className="relative mt-3 inline-flex w-fit items-center rounded-full bg-[#F59E0B]/12 px-2.5 py-1 text-xs font-medium text-[#F59E0B]">{aviso}</p>}
      {extras?.length > 0 && (
        <dl className="relative mt-auto pt-5">
          <div className="grid grid-cols-2 gap-4 border-t border-default pt-4">
            {extras.map((e) => (
              <div key={e.rotulo}>
                <dt className="flex items-center gap-1.5 text-xs text-muted">
                  <span aria-hidden="true" className="text-[#FA4C00]">{e.icone}</span>
                  {e.rotulo}
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{e.valor}</dd>
              </div>
            ))}
          </div>
        </dl>
      )}
    </div>
  );
}

/** Cartão de gráfico: ícone, título/subtítulo, legenda e (opcional) uma faixa de destaques acima do gráfico. */
export function CardGrafico({ icone, titulo, subtitulo, legenda, destaques, children, indice = 0 }) {
  return (
    <section aria-label={titulo} className="anim-in rounded-2xl border border-default bg-surface p-5 flex flex-col" style={{ "--i": indice }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          {icone && (
            <span aria-hidden="true" className="grid place-items-center w-9 h-9 rounded-xl bg-[#FA4C00]/12 text-[#FA4C00] shrink-0">
              {icone}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">{titulo}</h2>
            {subtitulo && <p className="text-xs text-muted mt-1">{subtitulo}</p>}
          </div>
        </div>
        {legenda}
      </div>
      {destaques && <dl className="mt-4 flex flex-wrap gap-2">{destaques}</dl>}
      <div className="mt-4 flex-1 min-h-0 flex flex-col">{children}</div>
    </section>
  );
}

/** Destaque pequeno acima do gráfico (ex.: "Pico previsto · 08h · 3 veículos"). */
export function Destaque({ rotulo, valor, cor }) {
  return (
    <div className="inline-flex items-baseline gap-2 rounded-xl bg-surface-2 px-3 py-1.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{rotulo}</dt>
      <dd className="text-sm font-semibold tabular-nums" style={cor ? { color: cor } : undefined}>{valor}</dd>
    </div>
  );
}
