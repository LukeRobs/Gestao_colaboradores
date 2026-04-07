import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Upload } from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";

function dateOnlyBrasil(dateStr) {
  if (!dateStr) return null;

  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export default function NovoAtestado() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [form, setForm] = useState({
    cpf: "",
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

  const inicio = dateOnlyBrasil(form.dataInicio);
  const fim = dateOnlyBrasil(form.dataFim);

  if (!inicio || !fim || fim < inicio) return 0;

  const diffMs = fim.getTime() - inicio.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDias + 1;
}


  const diasAfastamento = calcularDiasAfastamento();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }
const [uploading, setUploading] = useState(false);

  /* ================= SALVAR ================= */
  async function handleSave() {
    if (saving || uploading) return;

    const cpfLimpo = form.cpf.replace(/\D/g, "");

    if (!cpfLimpo || cpfLimpo.length !== 11) {
      alert("Informe um CPF válido do colaborador.");
      return;
    }

    if (!form.dataInicio || !form.dataFim) {
      alert("Informe o período do atestado.");
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
      console.log("1️⃣ Solicitando presign para CPF:", cpfLimpo);
      const presignRes = await api.post(
        "/atestados-medicos/presign-upload",
        { cpf: cpfLimpo }
      );
      console.log("1️⃣ Presign response:", presignRes.data);

      const { uploadUrl, key } = presignRes.data.data;
      console.log("1️⃣ uploadUrl:", uploadUrl, "key:", key);

      /* 2️⃣ Upload direto para o R2 */
      setUploading(true);
      console.log("2️⃣ Fazendo upload do PDF...");

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });

      setUploading(false);
      console.log("2️⃣ Upload status:", uploadRes.status, uploadRes.ok);

      if (!uploadRes.ok) {
        const uploadErr = await uploadRes.text();
        console.error("2️⃣ Upload falhou:", uploadErr);
        alert(`Falha ao enviar o PDF (${uploadRes.status}): ${uploadErr}`);
        return;
      }

      /* 3️⃣ Criação do atestado */
      const payload = {
        ...form,
        cpf: cpfLimpo,
        diasAfastamento,
        documentoKey: key,
      };
      console.log("3️⃣ Criando atestado com payload:", payload);

      const createRes = await api.post("/atestados-medicos", payload);
      console.log("3️⃣ Atestado criado:", createRes.data);

      navigate("/atestados");
    } catch (err) {
      console.error("❌ ERRO COMPLETO:", err);
      console.error("❌ RESPONSE DATA:", err?.response?.data);
      const msg = err?.response?.data?.message || err?.message || "Erro ao salvar atestado médico.";
      alert(`Erro: ${msg}`);
    } finally {
      setUploading(false);
      setSaving(false);
    }
  }


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
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg bg-surface"
              >
                <ArrowLeft size={18} />
              </button>

              <div>
                <h1 className="text-2xl font-semibold">
                  Novo Atestado Médico
                </h1>
                <p className="text-sm text-muted">
                  Upload de PDF obrigatório
                </p>
              </div>
            </div>

           <button
              disabled={saving || uploading}
              onClick={handleSave}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl
                ${saving || uploading ? "bg-[#555] cursor-not-allowed" : "bg-[#FA4C00]"}`}
            >
              <Save size={16} />
              {uploading
                ? "Enviando PDF..."
                : saving
                ? "Salvando..."
                : "Salvar"}
            </button>

          </div>

          {/* FORM */}
          <Section title="Informações do Atestado">
            <Input
              name="cpf"
              label="CPF do Colaborador"
              value={form.cpf}
              onChange={handleChange}
              placeholder="000.000.000-00"
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
              min={form.dataInicio || undefined}
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
            />

            <Textarea
              name="observacao"
              label="Observações"
              value={form.observacao}
              onChange={handleChange}
            />

            {/* PDF */}
            <div className="md:col-span-2">
              <label className="text-xs text-muted">
                PDF do Atestado
              </label>
              <label className="flex items-center gap-3 px-4 py-3 bg-surface-2 rounded-xl cursor-pointer">
                <Upload size={16} />
                <span>{file ? file.name : "Selecionar PDF"}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
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
    <div className="bg-surface border border-default rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-muted mb-6 uppercase">
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

function Textarea({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1 md:col-span-2">
      <label className="text-xs text-muted">{label}</label>
      <textarea
        {...props}
        rows={3}
        className="px-4 py-2.5 bg-surface-2 border border-default rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
