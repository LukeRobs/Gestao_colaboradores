import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Upload } from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";

export default function NovoAtestado() {
  const navigate = useNavigate();
  const { opsId } = useParams(); // opcional (quando vem do perfil)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [form, setForm] = useState({
    opsId: opsId || "",
    dataInicio: "",
    dataFim: "",
    cid: "",
    observacao: "",
  });

  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  /* ================= DIAS DERIVADOS ================= */
  function calcularDiasAfastamento() {
    if (!form.dataInicio || !form.dataFim) return 0;

    const inicio = new Date(form.dataInicio);
    const fim = new Date(form.dataFim);
    if (fim < inicio) return 0;

    return (
      Math.ceil(
        (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
    );
  }

  const diasAfastamento = calcularDiasAfastamento();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  /* ================= SALVAR ================= */
  async function handleSave() {
    if (saving) return;

    if (!form.opsId || !form.dataInicio || !form.dataFim) {
      alert("Preencha OPS ID e o período do atestado.");
      return;
    }

    if (!file) {
      alert("O PDF do atestado é obrigatório.");
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Arquivo inválido. Envie apenas PDF.");
      return;
    }

    try {
      setSaving(true);

      /* 1️⃣ Presign upload */
      const presignRes = await api.post(
        "/atestados-medicos/presign-upload",
        {
          opsId: form.opsId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }
      );

      const { uploadUrl, key } = presignRes.data.data;

      /* 2️⃣ Upload direto para o R2 */
      const upload = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type, // application/pdf
        },
        body: file,
      });


      if (!upload.ok) {
        console.error("Erro PUT:", upload.status);
        alert("Falha ao enviar o PDF para o armazenamento.");
        return;
      }

      /* 3️⃣ Criação do atestado no backend */
      await api.post("/atestados-medicos", {
        ...form,
        diasAfastamento,
        documentoKey: key,
      });

      navigate("/atestados");
    } catch (err) {
      console.error("Erro ao salvar atestado:", err);
      alert("Erro ao salvar atestado médico.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
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
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg bg-[#1A1A1C] hover:bg-[#2A2A2C]"
              >
                <ArrowLeft size={18} />
              </button>

              <div>
                <h1 className="text-2xl font-semibold">
                  Novo Atestado Médico
                </h1>
                <p className="text-sm text-[#BFBFC3]">
                  Upload de PDF obrigatório + registro de afastamento
                </p>
              </div>
            </div>

            <button
              disabled={saving}
              onClick={handleSave}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium
                ${
                  saving
                    ? "bg-[#FA4C00]/50 cursor-not-allowed"
                    : "bg-[#FA4C00] hover:bg-[#ff5a1a]"
                }
              `}
            >
              <Save size={16} />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>

          {/* FORM */}
          <Section title="Informações do Atestado">
            <Input
              name="opsId"
              label="OPS ID do Colaborador"
              value={form.opsId}
              onChange={handleChange}
              placeholder="Ex: OPS001"
            />

            <Input
              type="date"
              name="dataInicio"
              label="Data de Início"
              value={form.dataInicio}
              onChange={handleChange}
            />

            <Input
              type="date"
              name="dataFim"
              label="Data de Fim"
              value={form.dataFim}
              onChange={handleChange}
            />

            <Info
              label="Dias de Afastamento"
              value={diasAfastamento > 0 ? `${diasAfastamento} dias` : "-"}
            />

            <Input
              name="cid"
              label="CID (opcional)"
              value={form.cid}
              onChange={handleChange}
              placeholder="Ex: M54.5"
            />

            <Textarea
              name="observacao"
              label="Observações"
              value={form.observacao}
              onChange={handleChange}
            />

            {/* PDF */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs text-[#BFBFC3]">
                PDF do Atestado (obrigatório)
              </label>

              <label className="flex items-center gap-3 px-4 py-3 bg-[#2A2A2C] border border-[#3D3D40] rounded-xl cursor-pointer hover:bg-[#242426]">
                <Upload size={16} className="text-[#BFBFC3]" />
                <span className="text-sm">
                  {file ? file.name : "Selecionar arquivo PDF"}
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) =>
                    setFile(e.target.files?.[0] || null)
                  }
                />
              </label>

              <p className="text-xs text-[#BFBFC3] mt-1">
                Apenas PDF. Recomendado até 5MB.
              </p>
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
}

/* ================= UI ================= */

function Section({ title, children }) {
  return (
    <div className="bg-[#1A1A1C] border border-[#3D3D40] rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-[#BFBFC3] mb-6 uppercase">
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
      <label className="text-xs text-[#BFBFC3]">{label}</label>
      <input
        {...props}
        className="px-4 py-2.5 bg-[#2A2A2C] border border-[#3D3D40] rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      />
    </div>
  );
}

function Textarea({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1 md:col-span-2">
      <label className="text-xs text-[#BFBFC3]">{label}</label>
      <textarea
        {...props}
        rows={3}
        className="px-4 py-2.5 bg-[#2A2A2C] border border-[#3D3D40] rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-[#BFBFC3]">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
