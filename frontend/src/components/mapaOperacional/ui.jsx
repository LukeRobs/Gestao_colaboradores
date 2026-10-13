import { useEffect, useId, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Info,
  Loader2,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { MapaOperacionalAPI } from "../../services/mapaOperacional";
import { BTN_PRIMARIO, BTN_SECUNDARIO, FOCO, INPUT, somarDias } from "./uiTokens";

/* =====================================================
   Kit visual compartilhado das telas do Label (esteiras, FULL D+1,
   Gestão de Docas e seus modais). Evolui o padrão que o projeto já usa
   (tokens bg-surface / border-default / text-muted + laranja da marca)
   em vez de criar outro: o objetivo é só não repetir a mesma coisa
   com pequenas diferenças em cada tela.
===================================================== */

/* ---------- Cabeçalho da página ---------- */

export function PageHeader({ kicker = "Operação · Label", titulo, subtitulo, atualizadoEm, atualizando, onAtualizar }) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-3">
      <div>
        <p className="text-xs text-muted uppercase tracking-wide">{kicker}</p>
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        {subtitulo && <p className="text-sm text-muted mt-0.5">{subtitulo}</p>}
      </div>
      {onAtualizar && (
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted tabular-nums" aria-live="polite">
            {atualizadoEm
              ? `Atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : ""}
          </p>
          <button type="button" onClick={onAtualizar} disabled={atualizando} className={`${BTN_SECUNDARIO} font-normal disabled:cursor-wait`}>
            <RefreshCw size={14} className={atualizando ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Turno e dia ---------- */

export function TurnoTabs({ turno, turnoAgora, onChange }) {
  return (
    <div role="tablist" aria-label="Turno" className="flex items-center gap-1 bg-surface rounded-xl p-1 border border-default w-fit">
      {["T1", "T2", "T3"].map((t) => {
        const ativo = turno === t;
        return (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={ativo}
            onClick={() => onChange(t)}
            className={`px-4 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${FOCO} ${
              ativo ? "bg-[#FA4C00] text-white" : "text-muted hover:text-page hover:bg-surface-2"
            }`}
          >
            {t}
            {turnoAgora === t && <span className="ml-1.5 text-[10px] opacity-80">· agora</span>}
          </button>
        );
      })}
    </div>
  );
}

export function DiaNavegador({ data, maximo, onChange }) {
  const noLimite = !!maximo && !!data && data >= maximo;
  const botao = `h-9 w-9 grid place-items-center rounded-lg text-muted hover:text-page hover:bg-surface-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${FOCO}`;
  return (
    <div className="flex items-center gap-1 bg-surface rounded-xl p-1 border border-default w-fit">
      <button type="button" onClick={() => data && onChange(somarDias(data, -1))} aria-label="Dia anterior" className={botao}>
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <input
        type="date"
        value={data || ""}
        max={maximo}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label="Dia operacional"
        className={`h-9 px-2 bg-transparent text-sm text-page rounded-lg cursor-pointer ${FOCO}`}
      />
      <button type="button" onClick={() => data && onChange(somarDias(data, 1))} disabled={noLimite} aria-label="Próximo dia" className={botao}>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/* ---------- Avisos e estados ---------- */

const AVISOS = {
  info: { cor: "#8B8B93", Icone: Info, papel: "status" },
  alerta: { cor: "#F59E0B", Icone: TriangleAlert, papel: "status" },
  erro: { cor: "#FF453A", Icone: CircleAlert, papel: "alert" },
};

export function Aviso({ tipo = "info", children, acao }) {
  const { cor, Icone, papel } = AVISOS[tipo];
  const neutro = tipo === "info";
  return (
    <div
      role={papel}
      className={`flex items-center justify-between gap-3 flex-wrap text-sm rounded-xl px-4 py-3 border ${neutro ? "bg-surface border-default text-muted" : ""}`}
      style={neutro ? undefined : { color: cor, background: `${cor}14`, borderColor: `${cor}40` }}
    >
      <span className="flex items-center gap-2.5">
        <Icone size={16} className="shrink-0" aria-hidden="true" />
        <span>{children}</span>
      </span>
      {acao}
    </div>
  );
}

export function EstadoVazio({ icone, titulo, descricao, acao }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 px-6 py-12 text-muted">
      {icone}
      <p className="font-medium text-page">{titulo}</p>
      {descricao && <p className="text-sm max-w-sm">{descricao}</p>}
      {acao}
    </div>
  );
}

export function Esqueleto({ className = "" }) {
  return <div aria-hidden="true" className={`bg-surface-2 rounded-xl animate-pulse motion-reduce:animate-none ${className}`} />;
}

/* ---------- Faixa de indicadores (um painel só, em vez de N cards) ---------- */

const COLUNAS_XL = { 3: "xl:grid-cols-3", 4: "xl:grid-cols-4", 5: "xl:grid-cols-5", 6: "xl:grid-cols-6" };

export function FaixaIndicadores({ itens, rotulo }) {
  return (
    <section aria-label={rotulo} className="rounded-2xl border border-default bg-surface overflow-hidden">
      <dl className={`grid grid-cols-2 sm:grid-cols-3 ${COLUNAS_XL[itens.length] || "xl:grid-cols-5"} -mr-px -mb-px`}>
        {itens.map((item) => (
          <div key={item.rotulo} className="border-r border-b border-default p-4">
            <dt className="text-xs text-muted">{item.rotulo}</dt>
            <dd className={`mt-1 font-semibold tabular-nums ${item.destaque ? "text-3xl" : "text-2xl"}`} style={item.cor ? { color: item.cor } : undefined}>
              {item.valor}
            </dd>
            {item.apoio && <p className="text-xs text-muted mt-0.5">{item.apoio}</p>}
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ---------- Abas segmentadas (dentro de modais e painéis) ---------- */

export function AbasSegmentadas({ rotulo, opcoes, valor, onChange }) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex gap-1 bg-surface-2 rounded-xl p-1">
      {opcoes.map((o) => {
        const ativo = valor === o.valor;
        return (
          <button
            key={o.valor}
            role="tab"
            type="button"
            aria-selected={ativo}
            onClick={() => onChange(o.valor)}
            className={`flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${FOCO} ${
              ativo ? "bg-[#FA4C00] text-white" : "text-muted hover:text-page"
            }`}
          >
            {o.icone}
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Abas da página (troca de visão: Docas / Equipes) ---------- */

export function AbasPagina({ rotulo, opcoes, valor, onChange }) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex gap-1 border-b border-default overflow-x-auto">
      {opcoes.map((o) => {
        const ativo = valor === o.valor;
        return (
          <button
            key={o.valor}
            role="tab"
            type="button"
            aria-selected={ativo}
            onClick={() => onChange(o.valor)}
            className={`-mb-px h-11 px-4 inline-flex items-center gap-2 border-b-2 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${FOCO} ${
              ativo ? "border-[#FA4C00] text-page" : "border-transparent text-muted hover:text-page"
            }`}
          >
            {o.icone}
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Modal ---------- */

// Com modais empilhados (detalhe da doca -> adicionar equipe), só o de cima reage ao Esc.
const pilhaDeModais = [];

export function Modal({ titulo, subtitulo, kicker, onClose, bloqueado = false, largura = "max-w-md", z = "z-50", children }) {
  const idTitulo = useId();
  const dialogoRef = useRef(null);
  const meuId = useRef(Symbol("modal"));
  // Quem tinha o foco antes do modal abrir (capturado antes do autoFocus dos campos internos).
  const [origemDoFoco] = useState(() => document.activeElement);
  const bloqueadoRef = useRef(bloqueado);
  const fecharRef = useRef(onClose);

  // Sempre a versão mais recente, sem refazer o efeito (que mexe em foco e na pilha).
  useEffect(() => {
    bloqueadoRef.current = bloqueado;
    fecharRef.current = onClose;
  });

  useEffect(() => {
    const id = meuId.current;
    const dialogo = dialogoRef.current;
    pilhaDeModais.push(id);
    // Se um campo do modal já pegou o foco (autoFocus), não tira dele.
    if (dialogo && !dialogo.contains(document.activeElement)) dialogo.focus();

    const aoTeclar = (ev) => {
      if (ev.key === "Escape" && pilhaDeModais[pilhaDeModais.length - 1] === id && !bloqueadoRef.current) fecharRef.current();
    };
    window.addEventListener("keydown", aoTeclar);

    return () => {
      window.removeEventListener("keydown", aoTeclar);
      const i = pilhaDeModais.indexOf(id);
      if (i >= 0) pilhaDeModais.splice(i, 1);
      // Só devolve o foco se o diálogo realmente saiu da página (o StrictMode do React
      // desmonta e remonta o efeito em desenvolvimento, e isso não pode roubar o foco).
      setTimeout(() => {
        if (dialogo && !dialogo.isConnected && origemDoFoco instanceof Element && typeof origemDoFoco.focus === "function" && document.contains(origemDoFoco)) {
          origemDoFoco.focus();
        }
      }, 0);
    };
  }, [origemDoFoco]);

  return (
    <div className={`fixed inset-0 ${z} flex items-center justify-center bg-black/60 p-4`} onClick={() => !bloqueado && onClose()}>
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={`bg-surface rounded-2xl w-full ${largura} border border-default shadow-2xl max-h-[85vh] flex flex-col outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-default shrink-0">
          <div className="min-w-0">
            {kicker && <p className="text-xs text-muted">{kicker}</p>}
            <h2 id={idTitulo} className="font-semibold text-base">{titulo}</h2>
            {subtitulo && <p className="text-xs text-muted mt-0.5">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={bloqueado}
            aria-label="Fechar"
            className={`h-10 w-10 -mr-2 -mt-1 grid place-items-center shrink-0 rounded-lg text-muted hover:text-page hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-50 ${FOCO}`}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Busca de colaborador elegível (nome, CPF ou Ops ID) ---------- */

// `indisponivel(colaborador)` devolve o motivo (texto) quando a pessoa não pode ser escolhida, ou null.
export function BuscaColaborador({ contexto, turno, onSelecionar, desabilitado = false, indisponivel, semPresenca = false }) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const termo = busca.trim();
  const termoValido = termo.length >= 2;

  useEffect(() => {
    if (!termoValido) return undefined;
    let ativo = true;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const lista = await MapaOperacionalAPI.buscarColaboradoresElegiveis({ contexto, turno, search: termo, semPresenca });
        if (ativo) setResultados(lista);
      } catch {
        if (ativo) setResultados([]);
      } finally {
        if (ativo) setBuscando(false);
      }
    }, 350);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [termo, termoValido, contexto, turno, semPresenca]);

  const lista = termoValido ? resultados : [];

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar colaborador por nome, CPF ou Ops ID"
          placeholder="Buscar por nome, CPF ou Ops ID"
          autoFocus
          className={`${INPUT} pl-10 pr-10`}
        />
        {buscando && <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      </div>

      {!termoValido ? (
        <p className="text-xs text-muted">
          {semPresenca
            ? "Digite ao menos 2 letras. Aparecem colaboradores do turno e do setor corretos; a presença é conferida quando o turno começar."
            : "Digite ao menos 2 letras. Só aparecem presentes (P) do turno e do setor correto."}
        </p>
      ) : lista.length > 0 ? (
        <ul className="rounded-xl border border-default divide-y divide-default max-h-64 overflow-y-auto">
          {lista.map((c) => {
            const motivo = indisponivel?.(c) || null;
            return (
              <li key={c.opsId}>
                <button
                  type="button"
                  onClick={() => onSelecionar(c)}
                  disabled={desabilitado || !!motivo}
                  className={`w-full text-left px-3.5 py-2.5 min-h-[44px] transition-colors ${FOCO} ${
                    motivo ? "cursor-not-allowed" : "hover:bg-surface-2 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                  }`}
                >
                  <span className={`block text-sm ${motivo ? "text-muted" : ""}`}>{c.nomeCompleto}</span>
                  <span className="block text-xs text-muted mt-0.5">
                    {c.opsId} · {c.setor?.nomeSetor || c.cargo?.nomeCargo || "—"}
                  </span>
                  {motivo && <span className="block text-xs text-[#F59E0B] mt-1">{motivo}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        !buscando && (
          <p className="text-sm text-muted text-center py-3">
            Nenhum colaborador elegível encontrado.
            <span className="block text-xs mt-1">Confira se está presente (P), no turno e no setor corretos.</span>
          </p>
        )
      )}
    </div>
  );
}

/* ---------- Alocação de diarista (saldo do Daily Works + ação) ---------- */

export function PainelDiarista({ saldo, rotuloAcao, onAlocar, ocupado = false }) {
  const semSaldo = !!saldo && saldo.disponiveis <= 0;
  return (
    <div className="space-y-3">
      <div className="bg-surface-2 rounded-xl px-4 py-3">
        {saldo ? (
          <>
            <p className="text-sm">
              <b className="tabular-nums text-base">{saldo.disponiveis}</b> {saldo.disponiveis === 1 ? "diarista disponível" : "diaristas disponíveis"}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {saldo.total} lançados no Daily Works · {saldo.alocados} já alocados neste turno
            </p>
          </>
        ) : (
          <Esqueleto className="h-9" />
        )}
      </div>
      <button type="button" onClick={onAlocar} disabled={ocupado || !saldo || semSaldo} className={`${BTN_PRIMARIO} w-full`}>
        {ocupado && <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {ocupado ? "Alocando…" : rotuloAcao}
      </button>
      {semSaldo && <p className="text-xs text-muted text-center">Sem saldo de diaristas neste turno.</p>}
    </div>
  );
}
