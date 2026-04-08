// src/pages/DailyWorks/dwNovo.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";

/* ==============================
   EMPRESAS FIXAS
============================== */
const EMPRESAS = [
  { idEmpresa: 12, nome: "SRM" },
  { idEmpresa: 13, nome: "Fenix" },
  { idEmpresa: 14, nome: "Horeca" },
];

export default function DwNovoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const editData = location.state;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDw, setLoadingDw] = useState(false);

  const [form, setForm] = useState({
    data: editData?.data || "",
    idTurno: editData?.turno || "",
    observacao: "",
    quantidades: {
      12: "",
      13: "",
      14: "",
    },
  });

  /* ==============================
     CARREGAR DW EXISTENTE (EDIÇÃO)
  ===============================*/
  useEffect(() => {
    if (!editData?.data || !editData?.turno) return;

    async function loadDwReal() {
      try {
        setLoadingDw(true);

        const res = await api.get("/dw/real", {
          params: {
            data: editData.data,
            idTurno: editData.turno,
          },
        });

        const registros = res.data.data || [];

        const novasQuantidades = { 12: "", 13: "", 14: "" };
        let obs = "";

        registros.forEach((r) => {
          novasQuantidades[r.idEmpresa] = r.quantidade;
          if (r.observacao) obs = r.observacao;
        });

        setForm((prev) => ({
          ...prev,
          quantidades: novasQuantidades,
          observacao: obs,
        }));
      } catch (error) {
        console.error("Erro ao carregar DW:", error);
      } finally {
        setLoadingDw(false);
      }
    }

    loadDwReal();
  }, [editData]);

  /* ================= HANDLERS ================= */

  const handleQuantidade = (idEmpresa, value) => {
    setForm((prev) => ({
      ...prev,
      quantidades: {
        ...prev.quantidades,
        [idEmpresa]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!form.data || !form.idTurno) {
      alert("Data e Turno são obrigatórios");
      return;
    }

    const valores = Object.values(form.quantidades);
    if (valores.some((v) => v === "")) {
      alert("Informe a quantidade real de todas as empresas");
      return;
    }

    try {
      setSaving(true);

      await Promise.all(
        EMPRESAS.map((e) =>
          api.post("/dw/real", {
            data: form.data,
            idTurno: Number(form.idTurno),
            idEmpresa: e.idEmpresa,
            quantidade: Number(form.quantidades[e.idEmpresa]),
            observacao: form.observacao || null,
          })
        )
      );

      navigate("/dw");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar Daily Work");
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!editData;

  /* ================= UI ================= */

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 max-w-4xl mx-auto space-y-8">
          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/dw")}
                className="p-2 rounded-lg bg-surface hover:bg-surface-2"
              >
                <ArrowLeft size={18} />
              </button>

              <div>
                <h1 className="text-2xl font-semibold">
                  {isEdit ? "Editar Daily Work" : "Novo Daily Work"}
                </h1>
                <p className="text-sm text-muted">
                  Lançamento de DW Real por empresa e turno
                </p>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FA4C00] hover:bg-[#ff5a1a] rounded-xl font-medium disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>

          {/* ================= DADOS ================= */}
          <Section title="Dados do Daily Work">
            <Input
              type="date"
              label="Data *"
              value={form.data}
              onChange={(e) =>
                setForm((p) => ({ ...p, data: e.target.value }))
              }
            />

            <Select
              label="Turno *"
              value={form.idTurno}
              onChange={(e) =>
                setForm((p) => ({ ...p, idTurno: e.target.value }))
              }
              options={[
                { value: "1", label: "T1" },
                { value: "2", label: "T2" },
                { value: "3", label: "T3" },
              ]}
            />
          </Section>

          {/* ================= QUANTIDADES ================= */}
          <Section title="Quantidade Real por Empresa">
            {EMPRESAS.map((e) => (
              <Input
                key={e.idEmpresa}
                type="number"
                min="0"
                label={`${e.nome} *`}
                value={form.quantidades[e.idEmpresa]}
                onChange={(ev) =>
                  handleQuantidade(e.idEmpresa, ev.target.value)
                }
              />
            ))}
          </Section>

          {/* ================= OBS ================= */}
          <Section title="Observações">
            <Textarea
              label="Observação"
              value={form.observacao}
              onChange={(e) =>
                setForm((p) => ({ ...p, observacao: e.target.value }))
              }
            />
          </Section>
        </main>
      </div>
    </div>
  );
}

/* ================= COMPONENTES AUX ================= */

function Section({ title, children }) {
  return (
    <div className="bg-surface border border-default rounded-2xl p-6">
      <h2 className="text-xs font-semibold text-muted mb-6 uppercase">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {children}
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      <input
        {...props}
        className="px-4 py-2.5 bg-surface-2 border border-default rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      <select
        {...props}
        className="px-4 py-2.5 bg-surface-2 border border-default rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      >
        <option value="">Selecione</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Textarea({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1 md:col-span-2">
      <label className="text-xs text-muted">{label}</label>
      <textarea
        rows={4}
        {...props}
        className="px-4 py-2.5 bg-surface-2 border border-default rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      />
    </div>
  );
}