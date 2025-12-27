import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Upload } from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";

export default function NovaMedidaDisciplinar() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    opsId: "",
    dataAplicacao: "",
    tipoMedida: "",
    motivo: "",
  });

  const [file, setFile] = useState(null);
  const [colaborador, setColaborador] = useState(null);
  const [erroOps, setErroOps] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  /* ================= BUSCA COLABORADOR ================= */
  async function buscarColaborador() {
    if (!form.opsId) return;

    try {
      const res = await api.get(`/colaboradores/${form.opsId}`);
      setColaborador(res.data.data);
      setErroOps("");
    } catch {
      setColaborador(null);
      setErroOps("Colaborador não encontrado");
    }
  }

  /* ================= SALVAR ================= */
  async function handleSave() {
    if (!colaborador) {
      alert("Informe um OPS ID válido.");
      return;
    }

    if (!form.dataAplicacao || !form.tipoMedida || !form.motivo) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    if (!file) {
      alert("PDF da medida disciplinar é obrigatório.");
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Envie apenas arquivo PDF.");
      return;
    }

    try {
      setSaving(true);

      // 1️⃣ Presign upload
      const presign = await api.post(
        "/medidas-disciplinares/presign-upload",
        {
          opsId: form.opsId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }
      );

      const { uploadUrl, key } = presign.data.data;

      // 2️⃣ Upload direto no R2
      const upload = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });

      if (!upload.ok) {
        alert("Erro ao enviar PDF.");
        return;
      }

      // 3️⃣ Salvar registro
      await api.post("/medidas-disciplinares", {
        ...form,
        documentoKey: key,
      });

      navigate("/medidas-disciplinares");
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar medida disciplinar.");
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

        <main className="p-8 max-w-5xl mx-auto space-y-8">

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
                  Nova Medida Disciplinar
                </h1>
                <p className="text-sm text-[#BFBFC3]">
                  Registro disciplinar vinculado ao colaborador
                </p>
              </div>
            </div>

            <button
              disabled={saving}
              onClick={handleSave}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl
                ${
                  saving
                    ? "bg-[#FA4C00]/50 cursor-not-allowed"
                    : "bg-[#FA4C00] hover:bg-[#ff5a1a]"
                }`}
            >
              <Save size={16} />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>

          {/* OPS ID */}
          <Section title="Identificação do Colaborador">
            <Input
              label="OPS ID do Colaborador"
              name="opsId"
              value={form.opsId}
              onChange={handleChange}
              onBlur={buscarColaborador}
              placeholder="Ex: OPS001"
            />

            {erroOps && (
              <p className="text-sm text-red-400 md:col-span-2">
                {erroOps}
              </p>
            )}
          </Section>

          {colaborador && (
            <>
              {/* DADOS PESSOAIS */}
              <Section title="Dados Pessoais">
                <ReadOnly label="Nome" value={colaborador.nomeCompleto} />
                <ReadOnly label="CPF" value={colaborador.cpf} />
                <ReadOnly label="E-mail" value={colaborador.email} />
                <ReadOnly label="Telefone" value={colaborador.telefone} />
                <ReadOnly label="Gênero" value={colaborador.genero} />
                <ReadOnly label="Matrícula" value={colaborador.matricula} />
              </Section>

              {/* VÍNCULO */}
              <Section title="Vínculo Organizacional">
                <ReadOnly label="Empresa" value={colaborador.empresa?.razaoSocial} />
                <ReadOnly label="Setor" value={colaborador.setor?.nomeSetor} />
                <ReadOnly label="Cargo" value={colaborador.cargo?.nomeCargo} />
                <ReadOnly label="Turno" value={colaborador.turno?.nomeTurno} />
              </Section>

              {/* JORNADA */}
              <Section title="Jornada">
                <ReadOnly
                  label="Data de Admissão"
                  value={
                    colaborador.dataAdmissao
                      ? new Date(colaborador.dataAdmissao).toLocaleDateString()
                      : "-"
                  }
                />
                <ReadOnly
                  label="Início da Jornada"
                  value={
                    colaborador.horarioInicioJornada
                      ? colaborador.horarioInicioJornada.substring(11, 16)
                      : "-"
                  }
                />
              </Section>
            </>
          )}

          {/* MEDIDA */}
          <Section title="Dados da Medida Disciplinar">
            <Input
              type="date"
              label="Data da Aplicação"
              name="dataAplicacao"
              value={form.dataAplicacao}
              onChange={handleChange}
            />

            <Input
              label="Tipo da Medida"
              name="tipoMedida"
              value={form.tipoMedida}
              onChange={handleChange}
              placeholder="Ex: Advertência"
            />

            <Textarea
              label="Motivo da Medida"
              name="motivo"
              value={form.motivo}
              onChange={handleChange}
            />

            <FileUpload file={file} onChange={setFile} />
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
        className="px-4 py-2.5 bg-[#2A2A2C] border border-[#3D3D40]
        rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
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
        className="px-4 py-2.5 bg-[#2A2A2C] border border-[#3D3D40]
        rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      />
    </div>
  );
}

function ReadOnly({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[#BFBFC3]">{label}</label>
      <div className="px-4 py-2.5 bg-[#1E1E20] border border-[#2F2F33] rounded-xl text-sm">
        {value || "-"}
      </div>
    </div>
  );
}

function FileUpload({ file, onChange }) {
  return (
    <div className="md:col-span-2">
      <label className="text-xs text-[#BFBFC3]">
        PDF da Medida (obrigatório)
      </label>

      <label className="flex items-center gap-3 px-4 py-3 mt-1
        bg-[#2A2A2C] border border-[#3D3D40]
        rounded-xl cursor-pointer hover:bg-[#242426]"
      >
        <Upload size={16} />
        <span className="text-sm">
          {file ? file.name : "Selecionar arquivo PDF"}
        </span>

        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </label>
    </div>
  );
}
