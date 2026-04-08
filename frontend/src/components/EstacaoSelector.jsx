import { useEffect, useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { useEstacao } from "../context/EstacaoContext";
import { EstacoesAPI } from "../services/estacoes";

export default function EstacaoSelector() {
  const { estacaoId, isGlobal, selecionarEstacao } = useEstacao();
  const [estacoes, setEstacoes] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isGlobal) return;
    EstacoesAPI.listar().then(setEstacoes).catch(() => {});
  }, [isGlobal]);

  if (!isGlobal) return null;

  const selecionada = estacoes.find((e) => e.idEstacao === estacaoId);
  const label = selecionada ? selecionada.nomeEstacao : "Todas as estações";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-[#2C2C2F] hover:border-[#FA4C00]/50 transition text-sm text-muted"
      >
        <Building2 size={14} className="text-[#FA4C00] shrink-0" />
        <span className="max-w-[140px] truncate">{label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-surface border border-[#2C2C2F] rounded-xl shadow-2xl py-1 z-50">
          <button
            onClick={() => { selecionarEstacao(null); setOpen(false); }}
            className={`w-full px-4 py-2 text-left text-sm transition hover:bg-surface-2 ${!estacaoId ? "text-[#FA4C00]" : "text-muted"}`}
          >
            Todas as estações
          </button>

          <div className="border-t border-[#2C2C2F] my-1" />

          {estacoes.map((e) => (
            <button
              key={e.idEstacao}
              onClick={() => { selecionarEstacao(e.idEstacao); setOpen(false); }}
              className={`w-full px-4 py-2 text-left text-sm transition hover:bg-surface-2 truncate ${estacaoId === e.idEstacao ? "text-[#FA4C00]" : "text-muted"}`}
            >
              {e.nomeEstacao}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
