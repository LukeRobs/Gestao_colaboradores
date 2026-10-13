import { useEffect, useState } from "react";
import { User, UserPlus2 } from "lucide-react";
import toast from "react-hot-toast";
import { AbasSegmentadas, BuscaColaborador, Modal, PainelDiarista } from "./ui";
import { MapaOperacionalAPI } from "../../services/mapaOperacional";

/** `agendar` ({ turno, data }): pré-aloca num turno que ainda não começou, em vez de alocar agora. */
export function AlocarFullD1Modal({ onClose, onAllocated, agendar = null }) {
  const [aba, setAba] = useState("colaborador");
  const [salvando, setSalvando] = useState(false);
  const [saldoDiarista, setSaldoDiarista] = useState(null);
  const [chaveBusca, setChaveBusca] = useState(0);

  useEffect(() => {
    MapaOperacionalAPI.diaristasDisponiveis(agendar || undefined)
      .then(setSaldoDiarista)
      .catch(() => setSaldoDiarista(null));
  }, [agendar]);

  async function alocar(opsId, diarista) {
    setSalvando(true);
    try {
      if (agendar) {
        await MapaOperacionalAPI.agendarAlocacao({ idEsteira: null, labor: "FULL_D1", opsId, diarista, ...agendar });
        toast.success(`Pré-alocado no FULL D+1 (${agendar.turno})`);
        onAllocated?.();
        // Pré-alocação é feita em sequência: a busca recomeça limpa e o modal continua aberto.
        setChaveBusca((n) => n + 1);
        if (diarista) MapaOperacionalAPI.diaristasDisponiveis(agendar).then(setSaldoDiarista).catch(() => {});
      } else {
        await MapaOperacionalAPI.alocarFullD1({ opsId, diarista });
        toast.success(diarista ? "Diarista adicionado ao FULL D+1" : "Colaborador adicionado ao FULL D+1");
        onAllocated?.();
        onClose();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Erro ao adicionar no FULL D+1");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      kicker={agendar ? `FULL D+1 · pré-alocação do ${agendar.turno}` : "FULL D+1"}
      titulo={agendar ? "Pré-alocar no pool" : "Adicionar ao pool"}
      subtitulo={
        agendar
          ? "A pessoa entra sozinha quando o turno começar"
          : "Para quem trabalha no FULL D+1 sem passar pelo check-in da Workstation"
      }
      onClose={onClose}
      bloqueado={salvando}
    >
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
          rotuloAcao={agendar ? "Pré-alocar diarista" : "Adicionar diarista"}
          onAlocar={() => alocar(null, true)}
          ocupado={salvando}
        />
      )}
    </Modal>
  );
}
