import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AbasSegmentadas, Modal } from "../ui";
import { BTN_PRIMARIO, BTN_SECUNDARIO, FOCO, INPUT, LABORS_MANUAIS } from "../uiTokens";
import { MapaOperacionalAPI } from "../../../services/mapaOperacional";
import { DURACAO_PADRAO, DURACOES_AVISO, GRAVIDADES, MOTIVOS_AVISO } from "./avisosConfig";

const SELECT = `${INPUT} appearance-auto`;

/**
 * Sinaliza uma ocorrência (estilo Waze). Dois jeitos de abrir:
 *  - `alvoInicial` ({ alvoTipo, braco, lado, labor, numeroDoca }): o alvo já vem escolhido (botão da função, da doca...).
 *  - sem ele: a pessoa escolhe o alvo entre o que a tela oferece (`esteira` → braço/função; `docas` → doca).
 * `pessoas` ([{ opsId, nome }]) deixa ligar o aviso a alguém que está alocado ali (opcional).
 */
export function NovoAvisoModal({ esteira = null, docas = null, alvoInicial = null, pessoas = [], onClose, onCriado }) {
  const tipos = useMemo(() => {
    const t = [];
    if (esteira) t.push({ valor: "BRACO", rotulo: "Braço" }, { valor: "FUNCAO", rotulo: "Função" });
    if (docas) t.push({ valor: "DOCA", rotulo: "Doca" });
    return t;
  }, [esteira, docas]);

  const bracos = useMemo(
    () =>
      (esteira?.bracos || [])
        .filter((b) => b.habilitado)
        .sort((a, b) => a.numero - b.numero || String(a.lado).localeCompare(String(b.lado))),
    [esteira]
  );

  const [alvoTipo, setAlvoTipo] = useState(alvoInicial?.alvoTipo || tipos[0]?.valor || "BRACO");
  const [bracoChave, setBracoChave] = useState(alvoInicial?.braco ? `${alvoInicial.braco}-${alvoInicial.lado}` : "");
  const [labor, setLabor] = useState(alvoInicial?.labor || "");
  const [numeroDoca, setNumeroDoca] = useState(alvoInicial?.numeroDoca ? String(alvoInicial.numeroDoca) : "");
  const [motivo, setMotivo] = useState("");
  const [severidade, setSeveridade] = useState("ATENCAO");
  const [texto, setTexto] = useState("");
  const [duracaoMin, setDuracaoMin] = useState(DURACAO_PADRAO);
  const [opsId, setOpsId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const alvoFixo = !!alvoInicial;
  const subtituloAlvo = alvoFixo
    ? alvoInicial.alvoTipo === "DOCA"
      ? `Doca ${alvoInicial.numeroDoca}`
      : alvoInicial.alvoTipo === "BRACO"
        ? `Braço ${alvoInicial.braco}${alvoInicial.lado}`
        : LABORS_MANUAIS.find((l) => l.value === alvoInicial.labor)?.label
    : "Todos que abrirem a Label vão ver este aviso";

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    if (alvoTipo === "BRACO" && !bracoChave) return setErro("Escolha o braço.");
    if (alvoTipo === "FUNCAO" && !labor) return setErro("Escolha a função.");
    if (alvoTipo === "DOCA" && !numeroDoca) return setErro("Escolha a doca.");
    if (!motivo) return setErro("Escolha o que está acontecendo.");
    if (motivo === "OUTRO" && !texto.trim()) return setErro("Descreva a ocorrência.");

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

  return (
    <Modal kicker="Operação · Label" titulo="Sinalizar ocorrência" subtitulo={subtituloAlvo} onClose={onClose} bloqueado={enviando} largura="max-w-lg">
      <form onSubmit={enviar} className="space-y-4">
        {!alvoFixo && tipos.length > 1 && (
          <AbasSegmentadas rotulo="Onde" opcoes={tipos} valor={alvoTipo} onChange={setAlvoTipo} />
        )}

        {!alvoFixo && alvoTipo === "BRACO" && (
          <label className="block text-sm">
            <span className="text-xs text-muted">Braço</span>
            <select value={bracoChave} onChange={(e) => setBracoChave(e.target.value)} className={`${SELECT} mt-1`}>
              <option value="">Escolha o braço</option>
              {bracos.map((b) => (
                <option key={`${b.numero}-${b.lado}`} value={`${b.numero}-${b.lado}`}>
                  Braço {b.numero}{b.lado}
                </option>
              ))}
            </select>
          </label>
        )}

        {!alvoFixo && alvoTipo === "FUNCAO" && (
          <label className="block text-sm">
            <span className="text-xs text-muted">Função</span>
            <select value={labor} onChange={(e) => setLabor(e.target.value)} className={`${SELECT} mt-1`}>
              <option value="">Escolha a função</option>
              {LABORS_MANUAIS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </label>
        )}

        {!alvoFixo && alvoTipo === "DOCA" && (
          <label className="block text-sm">
            <span className="text-xs text-muted">Doca</span>
            <select value={numeroDoca} onChange={(e) => setNumeroDoca(e.target.value)} className={`${SELECT} mt-1`}>
              <option value="">Escolha a doca</option>
              {(docas || []).map((d) => (
                <option key={d.numero} value={d.numero}>Doca {d.numero}</option>
              ))}
            </select>
          </label>
        )}

        <fieldset>
          <legend className="text-xs text-muted mb-1.5">O que está acontecendo?</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {MOTIVOS_AVISO.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={motivo === m.value}
                onClick={() => setMotivo(m.value)}
                className={`h-11 px-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${FOCO} ${
                  motivo === m.value ? "border-[#FA4C00] bg-[#FA4C00]/10 text-[#FA4C00]" : "border-default bg-surface hover:bg-surface-2"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs text-muted mb-1.5">Gravidade</legend>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(GRAVIDADES).map(([valor, g]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={severidade === valor}
                onClick={() => setSeveridade(valor)}
                className={`h-11 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${FOCO} ${severidade === valor ? "" : "border-default bg-surface hover:bg-surface-2 text-muted"}`}
                style={severidade === valor ? { color: g.cor, background: `${g.cor}1F`, borderColor: g.cor } : undefined}
              >
                {g.rotulo}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="text-xs text-muted">Detalhe {motivo === "OUTRO" ? "(obrigatório)" : "(opcional)"}</span>
          <input
            type="text"
            value={texto}
            maxLength={200}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: esteira parou, aguardando manutenção"
            className={`${INPUT} mt-1`}
          />
        </label>

        {pessoas.length > 0 && (
          <label className="block text-sm">
            <span className="text-xs text-muted">Pessoa envolvida (opcional)</span>
            <select value={opsId} onChange={(e) => setOpsId(e.target.value)} className={`${SELECT} mt-1`}>
              <option value="">Ninguém específico</option>
              {pessoas.map((p) => (
                <option key={p.opsId} value={p.opsId}>{p.nome}</option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-sm">
          <span className="text-xs text-muted">Manter o aviso por</span>
          <select value={duracaoMin} onChange={(e) => setDuracaoMin(Number(e.target.value))} className={`${SELECT} mt-1`}>
            {DURACOES_AVISO.map((d) => (
              <option key={d.valor} value={d.valor}>{d.rotulo}</option>
            ))}
          </select>
          <span className="block text-xs text-muted mt-1">Some sozinho depois disso, ou quando alguém marcar como resolvido.</span>
        </label>

        {erro && (
          <p role="alert" className="text-sm text-[#FF453A]">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={enviando} className={BTN_SECUNDARIO}>
            Cancelar
          </button>
          <button type="submit" disabled={enviando} className={BTN_PRIMARIO}>
            {enviando ? "Publicando..." : "Publicar aviso"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
