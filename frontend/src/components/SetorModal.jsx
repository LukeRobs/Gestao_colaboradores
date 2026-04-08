import { useState, useEffect, useContext } from "react";
import { Button } from "./UIComponents";
import { X } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { EstacoesAPI } from "../services/estacoes";
import { useEstacao } from "../context/EstacaoContext";

export default function SetorModal({ setor, onClose, onSave }) {
  const { user } = useContext(AuthContext);
  const { estacaoId: estacaoSelecionada } = useEstacao();

  const isAdmin = user?.role === "ADMIN";
  // ADMIN sem estação selecionada precisa escolher no modal
  const precisaEscolherEstacao = isAdmin && !estacaoSelecionada && !setor;

  const [form, setForm] = useState({
    nomeSetor: setor?.nomeSetor || "",
    descricao: setor?.descricao || "",
    ativo: setor?.ativo ?? true,
    idEstacao: setor?.idEstacao || estacaoSelecionada || "",
  });
  const [saving, setSaving] = useState(false);
  const [estacoes, setEstacoes] = useState([]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  useEffect(() => {
    if (precisaEscolherEstacao) {
      EstacoesAPI.listar().then(setEstacoes).catch(() => {});
    }
  }, [precisaEscolherEstacao]);

  const handle = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isValid = form.nomeSetor.trim() && (!precisaEscolherEstacao || form.idEstacao);

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 sm:px-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg max-h-[92vh] bg-surface border border-default rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-default">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            {setor ? "Editar Setor" : "Novo Setor"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-surface-2 text-muted">
            <X size={18} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">

          {precisaEscolherEstacao && (
            <div>
              <label className="block text-xs text-muted mb-1">Estação</label>
              <select
                value={form.idEstacao}
                onChange={(e) => handle("idEstacao", e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 bg-surface-2 border border-default rounded-xl text-page text-sm"
              >
                <option value="">Selecione a estação</option>
                {estacoes.map((e) => (
                  <option key={e.idEstacao} value={e.idEstacao}>{e.nomeEstacao}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-muted mb-1">Nome do Setor</label>
            <input
              value={form.nomeSetor}
              onChange={(e) => handle("nomeSetor", e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 bg-surface-2 border border-default rounded-xl text-page text-sm focus:outline-none focus:ring-1 focus:ring-[#FA4C00]"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Descrição</label>
            <textarea
              rows={3}
              value={form.descricao}
              onChange={(e) => handle("descricao", e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 bg-surface-2 border border-default rounded-xl text-page text-sm focus:outline-none focus:ring-1 focus:ring-[#FA4C00]"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Status</label>
            <select
              value={form.ativo ? "true" : "false"}
              onChange={(e) => handle("ativo", e.target.value === "true")}
              className="w-full px-3 sm:px-4 py-2.5 bg-surface-2 border border-default rounded-xl text-page text-sm"
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 px-4 sm:px-6 py-4 border-t border-default">
          <Button.Secondary onClick={onClose} className="w-full sm:w-auto">Cancelar</Button.Secondary>
          <Button.Primary onClick={handleSave} disabled={saving || !isValid} className="w-full sm:w-auto">
            {saving ? "Salvando..." : setor ? "Salvar alterações" : "Criar setor"}
          </Button.Primary>
        </div>
      </div>
    </div>
  );
}
