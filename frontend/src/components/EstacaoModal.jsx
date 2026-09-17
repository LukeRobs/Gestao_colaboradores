import { X, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../services/api";

export default function EstacaoModal({ estacao, onClose, onSave, isAdmin = false }) {
  const [form, setForm] = useState(() => ({
    nome: estacao?.nomeEstacao || estacao?.nome || "",
    idRegional: estacao?.idRegional || "",
    sheetsMetaProducaoId: estacao?.sheetsMetaProducaoId || "",
    sheetsPresencaId: estacao?.sheetsPresencaId || "",
    seatalkGroupId: estacao?.seatalkGroupId || "",
    seatalkGroupIdPacking: estacao?.seatalkGroupIdPacking || "",
  }));

  const [emailRh, setEmailRh] = useState(() =>
    Array.isArray(estacao?.emailRh) ? estacao.emailRh : []
  );
  const [novoEmail, setNovoEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const [regionais, setRegionais] = useState([]);

  // 🔒 Bloqueia scroll do body
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  // 🔄 Carrega regionais
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await api.get("/regionais");
        if (!active) return;
        setRegionais(res.data.data || res.data);
      } catch (err) {
        console.error("Erro ao carregar regionais", err);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function adicionarEmail() {
    const email = novoEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("E-mail inválido");
      return;
    }
    if (emailRh.includes(email)) {
      setEmailError("E-mail já adicionado");
      return;
    }
    setEmailRh((prev) => [...prev, email]);
    setNovoEmail("");
    setEmailError("");
  }

  function removerEmail(email) {
    setEmailRh((prev) => prev.filter((e) => e !== email));
  }

  async function handleSave() {
    if (!form.nome || !form.idRegional) return;
    await onSave({ ...form, emailRh });
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 sm:px-6">
      
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="
          relative z-10
          w-full
          max-w-lg
          max-h-[92vh]
          bg-surface
          border border-default
          rounded-t-2xl sm:rounded-xl
          shadow-2xl
          flex flex-col
        "
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-default">
          <h2 className="text-base sm:text-lg font-semibold text-page">
            {estacao ? "Editar Estação" : "Nova Estação"}
          </h2>

          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-surface-2 text-muted"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENT (scrollável) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          <Input
            label="Nome da Estação"
            name="nome"
            value={form.nome}
            onChange={handleChange}
          />

          <Select
            label="Regional"
            name="idRegional"
            value={form.idRegional}
            onChange={handleChange}
            options={regionais}
            labelKey="nome"
            valueKey="idRegional"
          />

          {isAdmin && (
            <>
              <Input
                label="ID da Planilha Google Sheets (Gestão Operacional)"
                name="sheetsMetaProducaoId"
                value={form.sheetsMetaProducaoId}
                onChange={handleChange}
                placeholder="Ex: 17Dpmr1Kn6ybvK3rah2JvoCBsAeOvotvM6k_7uaATPz0"
              />

              <Input
                label="ID da Planilha Google Sheets (Controle de Presença)"
                name="sheetsPresencaId"
                value={form.sheetsPresencaId}
                onChange={handleChange}
                placeholder="Ex: 1lgrpflaIybMq7Z-8tZ7A6cueepYZ0yNBTSyDYvNaWNk"
              />

              <Input
                label="ID do Grupo Seatalk (Relatório Operacional)"
                name="seatalkGroupId"
                value={form.seatalkGroupId}
                onChange={handleChange}
                placeholder="Ex: oc_xxxxxxxxxxxxxxxxxxxxxxxx"
              />

              <Input
                label="ID do Grupo Seatalk (Gestão Operacional / Packing)"
                name="seatalkGroupIdPacking"
                value={form.seatalkGroupIdPacking}
                onChange={handleChange}
                placeholder="Ex: oc_xxxxxxxxxxxxxxxxxxxxxxxx"
              />

              {/* E-MAILS RELATÓRIO OPERACIONAL */}
              <div>
                <label className="text-xs text-muted">
                  E-mails — Relatório Operacional
                </label>

                {/* Lista atual */}
                {emailRh.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {emailRh.map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between px-3 py-1.5 bg-surface-2 border border-default rounded-lg text-sm"
                      >
                        <span className="text-page truncate">{email}</span>
                        <button
                          type="button"
                          onClick={() => removerEmail(email)}
                          className="ml-2 text-muted hover:text-[#FF453A] transition-colors shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input adicionar */}
                <div className="flex gap-2 mt-2">
                  <input
                    type="email"
                    value={novoEmail}
                    onChange={(e) => { setNovoEmail(e.target.value); setEmailError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarEmail())}
                    placeholder="nome@shopee.com"
                    className="flex-1 px-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[#FA4C00]"
                  />
                  <button
                    type="button"
                    onClick={adicionarEmail}
                    className="px-3 py-2 rounded-xl bg-[#FA4C00]/15 hover:bg-[#FA4C00]/25 text-[#FA4C00] transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {emailError && (
                  <p className="text-xs text-[#FF453A] mt-1">{emailError}</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 px-4 sm:px-6 py-4 border-t border-default">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-surface-2"
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#FA4C00]"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= UI ================= */

function Input({ label, ...props }) {
  return (
    <div>
      <label className="text-xs text-muted">{label}</label>
      <input
        {...props}
        className="
          w-full mt-1
          px-3 sm:px-4 py-2.5
          bg-surface-2
          border border-default
          rounded-xl
          text-page text-sm
          focus:outline-none focus:ring-1 focus:ring-[#FA4C00]
        "
      />
    </div>
  );
}

function Select({ label, options, labelKey, valueKey, ...props }) {
  return (
    <div>
      <label className="text-xs text-muted">{label}</label>
      <select
        {...props}
        className="
          w-full mt-1
          px-3 sm:px-4 py-2.5
          bg-surface-2
          border border-default
          rounded-xl
          text-page text-sm
        "
      >
        <option value="">Selecione</option>
        {options.map((o) => (
          <option key={o[valueKey]} value={o[valueKey]}>
            {o[labelKey]}
          </option>
        ))}
      </select>
    </div>
  );
}