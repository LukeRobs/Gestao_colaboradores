import { useEffect, useState } from "react";
import { User, UserPlus2 } from "lucide-react";
import toast from "react-hot-toast";
import { AbasSegmentadas, BuscaColaborador, Modal, PainelDiarista } from "./ui";
import { INPUT } from "./uiTokens";
import { MapaOperacionalAPI } from "../../services/mapaOperacional";

/** `agendar` ({ turno, data }): pré-aloca num turno que ainda não começou, em vez de alocar agora. */
export function AlocarLaborModal({ esteira, laborLabel, laborValue, onClose, onAllocated, agendar = null }) {
  const [aba, setAba] = useState("colaborador");
  const [salvando, setSalvando] = useState(false);
  const [saldoDiarista, setSaldoDiarista] = useState(null);
  // Pesca fica em um braço: pergunta já na entrada ("sem" = definir depois, arrastando no mapa).
  const pedeBraco = laborValue === "PESCA";
  const [bracoLado, setBracoLado] = useState("");
  // O modal fica aberto após cada alocação (só fecha no X ou clicando fora) e a busca recomeça limpa.
  const [chaveBusca, setChaveBusca] = useState(0);
  const bracos = (esteira.bracos || [])
    .filter((b) => b.habilitado)
    .sort((a, b) => a.numero - b.numero || String(a.lado).localeCompare(String(b.lado)));
  const aguardandoBraco = pedeBraco && !bracoLado;

  useEffect(() => {
    MapaOperacionalAPI.diaristasDisponiveis(agendar || undefined)
      .then(setSaldoDiarista)
      .catch(() => setSaldoDiarista(null));
  }, [agendar]);

  async function alocar(opsId, diarista) {
    setSalvando(true);
    try {
      if (agendar) {
        await MapaOperacionalAPI.agendarAlocacao({ idEsteira: esteira.idEsteira, labor: laborValue, opsId, diarista, ...agendar });
        toast.success(`Pré-alocado em ${laborLabel} (${agendar.turno})`);
      } else {
        const posicao = pedeBraco && bracoLado !== "sem" ? bracoLado.split("-") : [];
        await MapaOperacionalAPI.alocar(esteira.idEsteira, {
          opsId,
          diarista,
          labor: laborValue,
          ...(posicao.length ? { braco: Number(posicao[0]), lado: posicao[1] } : {}),
        });
        toast.success(diarista ? "Diarista alocado com sucesso" : "Colaborador alocado com sucesso");
      }
      onAllocated?.();
      setChaveBusca((n) => n + 1);
      if (diarista) MapaOperacionalAPI.diaristasDisponiveis(agendar || undefined).then(setSaldoDiarista).catch(() => {});
    } catch (e) {
      if (!e.tratado) toast.error(e.response?.data?.message || "Erro ao alocar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      kicker={agendar ? `${esteira.nome} · pré-alocação do ${agendar.turno}` : esteira.nome}
      titulo={laborLabel}
      subtitulo={agendar ? "A pessoa entra sozinha quando o turno começar" : "Alocar colaborador ou diarista nesta função"}
      onClose={onClose}
      bloqueado={salvando}
    >
      {pedeBraco && (
        <div className="space-y-1.5">
          <label htmlFor="braco-pesca" className="text-xs text-muted">
            Braço da pesca
          </label>
          <select id="braco-pesca" value={bracoLado} onChange={(e) => setBracoLado(e.target.value)} disabled={salvando} autoFocus className={INPUT}>
            <option value="">Escolha o braço…</option>
            <option value="sem">Sem braço (definir depois)</option>
            {bracos.map((b) => (
              <option key={`${b.numero}-${b.lado}`} value={`${b.numero}-${b.lado}`}>
                Braço {b.numero}{b.lado}
              </option>
            ))}
          </select>
          {aguardandoBraco && <p className="text-xs text-muted">Escolha o braço para continuar e buscar o colaborador.</p>}
        </div>
      )}

      {!aguardandoBraco && (
        <>
          <AbasSegmentadas
            rotulo="Tipo de alocação"
            valor={aba}
            onChange={setAba}
            opcoes={[
              { valor: "colaborador", rotulo: "Colaborador", icone: <User size={14} aria-hidden="true" /> },
              { valor: "diarista", rotulo: "Diarista", icone: <UserPlus2 size={14} aria-hidden="true" /> },
            ]}
          />

          {aba === "colaborador" ? (
            <BuscaColaborador
              key={chaveBusca}
              contexto="ESTEIRA"
              turno={agendar?.turno}
              semPresenca={!!agendar}
              onSelecionar={(c) => alocar(c.opsId, false)}
              desabilitado={salvando}
            />
          ) : (
            <PainelDiarista
              saldo={saldoDiarista}
              rotuloAcao={agendar ? "Pré-alocar diarista nesta função" : "Alocar diarista nesta função"}
              onAlocar={() => alocar(null, true)}
              ocupado={salvando}
            />
          )}
        </>
      )}
    </Modal>
  );
}
