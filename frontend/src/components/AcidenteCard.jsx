// src/components/AcidenteCard-compact.jsx
// VERSÃO COM LOGS PARA DEBUG
import { useContext, useState } from "react";
import {
  AlertTriangle,
  MapPin,
  Calendar,
  Clock,
  User,
  XCircle,
  X,
} from "lucide-react";

import { AcidentesAPI } from "../services/acidentes";
import { AuthContext } from "../context/AuthContext";

export default function AcidenteCardCompact({ acidente, onCancelado }) {
  
  const { user } = useContext(AuthContext);
  const podeCancelar =
    acidente?.status !== "CANCELADO" &&
    (user?.role === "ADMIN" || user?.name === acidente?.registradoPor);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [cancelando, setCancelando] = useState(false);

  const handleCancelar = async () => {
    if (!motivo.trim()) return;
    setCancelando(true);
    try {
      await AcidentesAPI.cancelar(acidente.idAcidente, motivo);
      setCancelModalOpen(false);
      if (onCancelado) onCancelado(acidente.idAcidente);
    } catch (err) {
      console.error(err);
      alert("Erro ao cancelar acidente");
    } finally {
      setCancelando(false);
    }
  };

  // 🔍 ADICIONE ESTES LOGS TEMPORÁRIOS (remova depois que funcionar)
  console.log("=== DEBUG CARD ===");
  console.log("1. Evidências:", acidente?.evidencias);
  console.log("2. Primeira evidência:", acidente?.evidencias?.[0]);
  console.log("3. urlImagem:", acidente?.evidencias?.[0]?.urlImagem);
  console.log("4. arquivoUrl:", acidente?.evidencias?.[0]?.arquivoUrl);
  console.log("==================");

  /* =========================
     FORMAT DATA
  ========================= */
  const dataFormatada = (() => {
    if (!acidente?.dataOcorrencia) return "-";
    const d = new Date(acidente.dataOcorrencia);
    if (isNaN(d)) return "-";
    return d.toLocaleDateString("pt-BR");
  })();

  const horaFormatada = (() => {
    if (!acidente?.horarioOcorrencia) return "-";
    const raw = acidente.horarioOcorrencia;
    if (typeof raw === "string" && raw.length <= 8) {
      return raw.slice(0, 5);
    }
    const d = new Date(raw);
    if (!isNaN(d)) {
      return d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return "-";
  })();

  const nome = acidente?.colaborador?.nomeCompleto || "-";
  const fotosCount = acidente?.evidencias?.length || 0;
  
  // 🔥 Tenta pegar urlImagem (que vem do backend melhorado)
  const primeiraFoto = acidente?.evidencias?.[0]?.urlImagem || null;

  const isPdf =
  primeiraFoto?.toLowerCase().endsWith(".pdf") ||
  primeiraFoto?.toLowerCase().includes(".pdf?");
  
  const registradoPor =
    acidente?.nomeRegistrante ||
    acidente?.registradoPor ||
    "Sistema";
  const tipo = acidente?.tipoOcorrencia || "-";

  /* =========================
     BADGE TIPO
  ========================= */
  const badgeConfig = (() => {
    const lower = tipo.toLowerCase();
    if (lower.includes("grave")) {
      return {
        bg: "bg-red-500/10",
        text: "text-red-400",
        border: "border-red-500/30",
        icon: "text-red-500"
      };
    }
    if (lower.includes("leve")) {
      return {
        bg: "bg-yellow-500/10",
        text: "text-yellow-400",
        border: "border-yellow-500/30",
        icon: "text-yellow-500"
      };
    }
    return {
      bg: "bg-orange-500/10",
      text: "text-orange-400",
      border: "border-orange-500/30",
      icon: "text-orange-500"
    };
  })();

  return (
    <>
    <div
      className="
        group
        bg-linear-to-br from-[#1A1A1C] to-[#151517]
        border border-[#2F2F33]
        rounded-2xl
        overflow-hidden
        transition-all duration-300
        hover:border-[#FA4C00]/50
        hover:shadow-2xl
        hover:shadow-[#FA4C00]/15
        hover:-translate-y-0.5
        cursor-pointer
      "
    >
      <div className="flex flex-col">
        
        {/* ================= CONTEÚDO ================= */}
        <div className="flex-1 p-5 lg:p-6 flex flex-col justify-between">
          
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <h3 className="text-lg lg:text-xl font-bold text-white tracking-tight flex-1">
                {nome}
              </h3>
              {acidente?.status === "CANCELADO" ? (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF453A]/10 text-[#FF453A] text-xs font-medium border border-[#FF453A]/20 shrink-0">
                  <XCircle size={12} /> Cancelado
                </span>
              ) : podeCancelar ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setMotivo(""); setCancelModalOpen(true); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF453A]/10 hover:bg-[#FF453A]/20 text-[#FF453A] text-xs font-medium border border-[#FF453A]/20 shrink-0 transition-colors cursor-pointer"
                >
                  <XCircle size={12} /> Cancelar
                </button>
              ) : null}
            </div>

            {/* Meta info compacta */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#9CA3AF] mb-4">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-[#FA4C00]" />
                {dataFormatada}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-[#FA4C00]" />
                {horaFormatada}
              </span>
              <span className="flex items-center gap-1.5 truncate max-w-xs">
                <MapPin size={13} className="text-[#FA4C00]" />
                {acidente?.localOcorrencia || "-"}
              </span>
            </div>

            {/* Ações Imediatas */}
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider text-[#6B7280] mb-1.5">
                Ações Imediatas
              </p>
              <p className="text-sm text-[#D1D5DB] leading-relaxed line-clamp-2">
                {acidente?.acoesImediatas || "Nenhuma ação registrada"}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#2F2F33]">
            
            {/* Registrado por */}
            <div className="flex items-center gap-2 text-xs">
              <User size={13} className="text-[#6B7280]" />
              <span className="text-[#9CA3AF]">
                por <span className="text-white font-semibold">{registradoPor}</span>
              </span>
            </div>

            {/* Badges + botão cancelar */}
            <div className="flex flex-wrap items-center gap-2">
              {acidente?.participouIntegracao && (
                <span className="px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-[10px] font-medium border border-green-500/20">
                  Integração
                </span>
              )}
              {acidente?.parteCorpoAtingida && (
                <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20 truncate max-w-[120px]">
                  {acidente.parteCorpoAtingida}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* MODAL CANCELAR ACIDENTE */}
    {cancelModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-surface rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <XCircle size={18} className="text-[#FF453A]" />
              <h2 className="font-semibold text-base text-white">Cancelar Acidente</h2>
            </div>
            <button onClick={() => setCancelModalOpen(false)} className="text-white/40 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="px-5 py-4 space-y-3">
            <p className="text-sm text-muted">
              Informe o motivo do cancelamento. Esta ação não pode ser desfeita.
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo do cancelamento..."
              rows={4}
              className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FF453A]/50 resize-none"
            />
          </div>

          <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-3">
            <button
              onClick={() => setCancelModalOpen(false)}
              className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={handleCancelar}
              disabled={cancelando || !motivo.trim()}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
                cancelando || !motivo.trim()
                  ? "bg-[#FF453A]/30 text-white/30 cursor-not-allowed"
                  : "bg-[#FF453A] hover:bg-[#D93025] text-white"
              }`}
            >
              <XCircle size={15} />
              {cancelando ? "Cancelando..." : "Confirmar cancelamento"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}