import { useMemo, useState } from "react";
import { Columns3, Megaphone, SlidersHorizontal, Truck, UserCog } from "lucide-react";
import toast from "react-hot-toast";
import { Modal } from "../ui";
import { BTN_SECUNDARIO, FOCO, INPUT, LABORS_MANUAIS } from "../uiTokens";
import { MapaOperacionalAPI } from "../../../services/mapaOperacional";
import { DURACAO_PADRAO, DURACOES_AVISO, GRAVIDADES, ICONES_FUNCAO, MOTIVOS_AVISO, motivoDe } from "./avisosConfig";

const ICONE_TIPO = { BRACO: Columns3, FUNCAO: UserCog, DOCA: Truck };
const NOME_TIPO = { BRACO: "Braço", FUNCAO: "Função", DOCA: "Doca" };
const SELECT = `${INPUT} appearance-auto`;

// Botão de escolha (tile) — selecionado = laranja da marca; área de toque ≥ 44 px.
function Tile({ ativo, onClick, children, className = "", ...resto }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${FOCO} ${
        ativo ? "border-[#FA4C00] bg-[#FA4C00] text-white" : "border-default bg-surface-2 hover:bg-surface-3 text-page"
      } ${className}`}
      {...resto}
    >
      {children}
    </button>
  );
}

function Titulo({ id, children, apoio }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-2">
      <p id={id} className="text-sm font-bold text-page">{children}</p>
      {apoio && <p className="text-xs text-muted">{apoio}</p>}
    </div>
  );
}

/**
 * Sinaliza uma ocorrência (estilo Waze) em 3 toques: onde → o que → publicar.
 * Gravidade, tempo no ar, detalhe e pessoa ficam em "Mais opções" (já vêm com um padrão bom).
 *  - `alvoInicial` ({ alvoTipo, braco, lado, labor, numeroDoca }): o onde já vem escolhido (botão da função, da doca...).
 *  - sem ele: escolhe entre o que a tela oferece (`esteira` → braço/função; `docas` → doca).
 * `pessoas` ([{ opsId, nome }]) liga o aviso a alguém alocado ali (opcional).
 */
export function NovoAvisoModal({ esteira = null, docas = null, alvoInicial = null, pessoas = [], onClose, onCriado }) {
  const tipos = useMemo(() => {
    const t = [];
    if (esteira) t.push("BRACO", "FUNCAO");
    if (docas) t.push("DOCA");
    return t;
  }, [esteira, docas]);

  const bracos = useMemo(
    () =>
      (esteira?.bracos || [])
        .filter((b) => b.habilitado)
        .sort((a, b) => a.numero - b.numero || String(a.lado).localeCompare(String(b.lado))),
    [esteira]
  );

  const alvoFixo = !!alvoInicial;
  const [alvoTipo, setAlvoTipo] = useState(alvoInicial?.alvoTipo || tipos[0] || "BRACO");
  const [bracoChave, setBracoChave] = useState(alvoInicial?.braco ? `${alvoInicial.braco}-${alvoInicial.lado}` : "");
  const [labor, setLabor] = useState(alvoInicial?.labor || "");
  const [numeroDoca, setNumeroDoca] = useState(alvoInicial?.numeroDoca ? String(alvoInicial.numeroDoca) : "");
  const [motivo, setMotivo] = useState("");
  const [severidade, setSeveridade] = useState("ATENCAO");
  const [gravidadeManual, setGravidadeManual] = useState(false);
  const [texto, setTexto] = useState("");
  const [duracaoMin, setDuracaoMin] = useState(DURACAO_PADRAO);
  const [opsId, setOpsId] = useState("");
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const nomeLabor = (v) => LABORS_MANUAIS.find((l) => l.value === v)?.label;
  const alvoPronto = alvoTipo === "BRACO" ? !!bracoChave : alvoTipo === "FUNCAO" ? !!labor : !!numeroDoca;
  const precisaDetalhe = motivo === "OUTRO";
  const pronto = alvoPronto && !!motivo && (!precisaDetalhe || !!texto.trim());

  const rotuloAlvo = !alvoPronto
    ? null
    : alvoTipo === "BRACO"
      ? `Braço ${bracoChave.replace("-", "")}`
      : alvoTipo === "FUNCAO"
        ? nomeLabor(labor)
        : `Doca ${numeroDoca}`;
  const IconeAlvo = alvoTipo === "FUNCAO" && labor ? ICONES_FUNCAO[labor] : ICONE_TIPO[alvoTipo];

  function escolherMotivo(valor) {
    setMotivo(valor);
    setErro("");
    // Sugere a gravidade do tipo (parado/problema = crítico), a não ser que o líder já tenha mexido nela.
    if (!gravidadeManual) setSeveridade(motivoDe(valor).gravidade);
    if (valor === "OUTRO") setMaisOpcoes(true);
  }

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    if (!pronto) return setErro(!alvoPronto ? "Escolha onde é a ocorrência." : !motivo ? "Escolha o que está acontecendo." : "Descreva a ocorrência.");

    const corpo = { alvoTipo, motivo, severidade, texto: texto.trim(), duracaoMin };
    if (alvoTipo === "BRACO") {
      const [braco, lado] = bracoChave.split("-");
      Object.assign(corpo, { idEsteira: esteira.idEsteira, braco: Number(braco), lado });
    } else if (alvoTipo === "FUNCAO") {
      Object.assign(corpo, { idEsteira: esteira.idEsteira, labor });
    } else {
      corpo.numeroDoca = Number(numeroDoca);
    }
    const pessoa = pessoas.find((p) => p.opsId === opsId);
    if (pessoa) Object.assign(corpo, { opsId: pessoa.opsId, nomePessoa: pessoa.nome });

    setEnviando(true);
    try {
      const criado = await MapaOperacionalAPI.criarAviso(corpo);
      toast.success(criado.renovado ? "Aviso renovado" : "Aviso publicado para todos");
      await onCriado?.();
      onClose();
    } catch (err) {
      setErro(err.response?.data?.message || "Não foi possível publicar o aviso.");
      setEnviando(false);
    }
  }

  const resumoGravidade = GRAVIDADES[severidade];

  return (
    <Modal
      kicker="Operação · Label"
      titulo="Sinalizar ocorrência"
      subtitulo="Todos que abrirem a Label vão ver o aviso"
      onClose={onClose}
      bloqueado={enviando}
      largura="max-w-xl"
    >
      <form onSubmit={enviar} className="space-y-5">
        {/* 1 · ONDE */}
        <section aria-labelledby="av-onde">
          <Titulo id="av-onde" apoio={rotuloAlvo ? undefined : "passo 1 de 2"}>
            Onde?
          </Titulo>

          {alvoFixo ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-default bg-surface-2 px-3.5 h-12">
              {IconeAlvo && <IconeAlvo size={18} className="text-[#FA4C00]" aria-hidden="true" />}
              <span className="text-sm font-bold">{rotuloAlvo}</span>
            </div>
          ) : (
            <div className="space-y-3">
              {tipos.length > 1 && (
                <div role="tablist" aria-label="Tipo de local" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${tipos.length}, minmax(0, 1fr))` }}>
                  {tipos.map((t) => {
                    const I = ICONE_TIPO[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        role="tab"
                        aria-selected={alvoTipo === t}
                        onClick={() => setAlvoTipo(t)}
                        className={`h-11 inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${FOCO} ${
                          alvoTipo === t ? "border-[#FA4C00] bg-[#FA4C00]/12 text-[#FA4C00]" : "border-default bg-surface hover:bg-surface-2 text-muted hover:text-page"
                        }`}
                      >
                        <I size={16} aria-hidden="true" /> {NOME_TIPO[t]}
                      </button>
                    );
                  })}
                </div>
              )}

              {alvoTipo === "BRACO" && (
                <div role="group" aria-label="Braço" className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {bracos.map((b) => {
                    const chave = `${b.numero}-${b.lado}`;
                    return (
                      <Tile key={chave} ativo={bracoChave === chave} onClick={() => setBracoChave(chave)} className="h-11 tabular-nums" aria-label={`Braço ${b.numero}${b.lado}`}>
                        {b.numero}{b.lado}
                      </Tile>
                    );
                  })}
                </div>
              )}

              {alvoTipo === "FUNCAO" && (
                <div role="group" aria-label="Função" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {LABORS_MANUAIS.map((l) => {
                    const I = ICONES_FUNCAO[l.value];
                    return (
                      <Tile key={l.value} ativo={labor === l.value} onClick={() => setLabor(l.value)} className="min-h-[56px] px-2 py-2 flex flex-col items-center justify-center gap-1 text-xs">
                        {I && <I size={18} aria-hidden="true" />}
                        {l.label}
                      </Tile>
                    );
                  })}
                </div>
              )}

              {alvoTipo === "DOCA" && (
                <div role="group" aria-label="Doca" className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {(docas || []).map((d) => (
                    <Tile key={d.numero} ativo={numeroDoca === String(d.numero)} onClick={() => setNumeroDoca(String(d.numero))} className="h-11 tabular-nums" aria-label={`Doca ${d.numero}`}>
                      {d.numero}
                    </Tile>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 2 · O QUE */}
        <section aria-labelledby="av-que">
          <Titulo id="av-que" apoio={rotuloAlvo && !motivo ? "passo 2 de 2" : undefined}>
            O que está acontecendo?
          </Titulo>
          <div role="group" aria-labelledby="av-que" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {MOTIVOS_AVISO.map((m) => (
              <Tile
                key={m.value}
                ativo={motivo === m.value}
                onClick={() => escolherMotivo(m.value)}
                title={m.dica}
                className="min-h-[84px] px-2 py-3 flex flex-col items-center justify-center gap-1.5"
              >
                <m.Icone size={26} strokeWidth={2.1} aria-hidden="true" />
                <span className="leading-tight text-center">{m.label}</span>
              </Tile>
            ))}
          </div>
        </section>

        {/* 3 · MAIS OPÇÕES (já vêm com padrão) */}
        <section className="rounded-xl border border-default">
          <button
            type="button"
            onClick={() => setMaisOpcoes((v) => !v)}
            aria-expanded={maisOpcoes}
            className={`w-full flex items-center justify-between gap-3 px-3.5 min-h-12 text-left cursor-pointer rounded-xl hover:bg-surface-2 ${FOCO}`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal size={16} className="text-muted" aria-hidden="true" /> Mais opções
            </span>
            <span className="flex items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1 font-semibold" style={{ color: resumoGravidade.cor }}>
                <resumoGravidade.Icone size={13} aria-hidden="true" /> {resumoGravidade.rotulo}
              </span>
              · {DURACOES_AVISO.find((d) => d.valor === duracaoMin)?.rotulo}
              {texto.trim() ? " · com detalhe" : ""}
              {opsId ? " · com pessoa" : ""}
            </span>
          </button>

          {maisOpcoes && (
            <div className="px-3.5 pb-3.5 pt-1 space-y-4 border-t border-default">
              <div>
                <Titulo>Gravidade</Titulo>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(GRAVIDADES).map(([valor, g]) => {
                    const ativo = severidade === valor;
                    return (
                      <button
                        key={valor}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => {
                          setSeveridade(valor);
                          setGravidadeManual(true);
                        }}
                        className={`h-12 inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${FOCO} ${ativo ? "" : "border-default bg-surface-2 hover:bg-surface-3 text-muted"}`}
                        style={ativo ? { background: g.fundo, color: g.texto, borderColor: g.fundo } : undefined}
                      >
                        <g.Icone size={18} aria-hidden="true" /> {g.rotulo}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Titulo apoio="some sozinho depois disso">Manter no ar por</Titulo>
                <div role="group" aria-label="Duração do aviso" className="grid grid-cols-4 gap-2">
                  {DURACOES_AVISO.map((d) => (
                    <Tile key={d.valor} ativo={duracaoMin === d.valor} onClick={() => setDuracaoMin(d.valor)} className="h-11">
                      {d.rotulo}
                    </Tile>
                  ))}
                </div>
              </div>

              <label className="block">
                <Titulo apoio={precisaDetalhe ? "obrigatório" : "opcional"}>Detalhe</Titulo>
                <input
                  type="text"
                  value={texto}
                  maxLength={200}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Ex.: esteira parou, aguardando manutenção"
                  className={INPUT}
                />
              </label>

              {pessoas.length > 0 && (
                <label className="block">
                  <Titulo apoio="opcional">Pessoa envolvida</Titulo>
                  <select value={opsId} onChange={(e) => setOpsId(e.target.value)} className={SELECT}>
                    <option value="">Ninguém específico</option>
                    {pessoas.map((p) => (
                      <option key={p.opsId} value={p.opsId}>{p.nome}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
        </section>

        {erro && (
          <p role="alert" className="text-sm font-medium text-[#FF453A]">
            {erro}
          </p>
        )}

        <div className="flex items-center gap-2.5">
          <button type="button" onClick={onClose} disabled={enviando} className={`${BTN_SECUNDARIO} h-12`}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || !pronto}
            className={`flex-1 h-12 px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FA4C00] hover:bg-[#D84300] text-white text-base font-bold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${FOCO}`}
          >
            <Megaphone size={18} aria-hidden="true" />
            {enviando ? "Publicando…" : pronto ? `Publicar: ${rotuloAlvo} · ${motivoDe(motivo).label}` : "Escolha onde e o que está acontecendo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
