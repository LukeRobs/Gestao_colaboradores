import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import MainLayout from "../../components/MainLayout";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";

/* ================= CONSTANTES ================= */

const NIVEIS_VIOLACAO = [
  { value: "BAIXA", label: "Baixa" },
  { value: "MEDIA", label: "Média" },
  { value: "ALTA", label: "Alta" },
];

const TIPOS_MEDIDA = [
  { value: "ADVERTENCIA", label: "Advertência Verbal" },
  { value: "ADVERTENCIA_ESCRITA", label: "Advertência Escrita" },
  { value: "SUSPENSAO", label: "Suspensão" },
  { value: "DEMISSAO", label: "Demissão" },
  { value: "DESLIGAMENTO_ANALISE_JURIDICA", label: "Desligamento (Análise Jurídica)" },
  { value: "JURIDICO", label: "Encaminhado ao Jurídico" },
];

export default function NovaMedidaDisciplinar() {

  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    cpf: "",
    nivelViolacao: "",
    violacao: "",
    tipoMedida: "",
    diasSuspensao: "",
    motivo: "",
    dataOcorrencia: "",
    dataAplicacao: "",
    idMatriz: "",
  });

  const [colaborador, setColaborador] = useState(null);
  const [erroCpf, setErroCpf] = useState("");
  const [conflito, setConflito] = useState(null); // sugestão em conflito

  function handleChange(e) {

    const { name, value } = e.target;

    setForm(prev => ({
      ...prev,
      [name]: value,
    }));

  }

  /* ================= BUSCAR COLABORADOR ================= */

  async function buscarColaborador() {

    if (!form.cpf) return;

    const cpfLimpo = form.cpf.replace(/\D/g, "");

    if (cpfLimpo.length !== 11) {
      setErroCpf("CPF inválido");
      setColaborador(null);
      return;
    }

    try {

      const res = await api.get(`/colaboradores/cpf/${cpfLimpo}`);

      setColaborador(res.data.data);
      setErroCpf("");

    } catch (err) {

      setColaborador(null);

      if (err.response?.status === 404) {
        setErroCpf("Colaborador não encontrado");
      } else {
        setErroCpf("Erro ao buscar colaborador");
      }

    }

  }

  /* ================= SALVAR ================= */

  async function salvar(forcarCriacao = false) {

    if (!colaborador) {
      alert("Informe um CPF válido.");
      return;
    }

    if (
      !form.nivelViolacao ||
      !form.violacao ||
      !form.tipoMedida ||
      !form.motivo ||
      !form.dataAplicacao
    ) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    try {

      setSaving(true);

      const res = await api.post("/medidas-disciplinares", {
        cpf: form.cpf,
        nivelViolacao: form.nivelViolacao,
        violacao: form.violacao,
        tipoMedida: form.tipoMedida,
        diasSuspensao: form.tipoMedida === "SUSPENSAO" ? Number(form.diasSuspensao) : null,
        motivo: form.motivo,
        dataOcorrencia: form.dataOcorrencia || null,
        dataAplicacao: form.dataAplicacao,
        idMatriz: form.idMatriz || null,
        forcarCriacao: forcarCriacao || undefined,
      });

      navigate(`/medidas-disciplinares/${res.data.data.idMedida}`);

    } catch (err) {

      if (err?.response?.status === 409 && err.response.data?.conflito) {
        // exibe modal de conflito
        setConflito(err.response.data.sugestao);
        return;
      }

      alert(err?.response?.data?.message || "Erro ao criar medida disciplinar.");

    } finally {

      setSaving(false);

    }

  }

  async function handleSave() {
    await salvar(false);
  }

  async function confirmarSobreporSugestao() {
    setConflito(null);
    await salvar(true);
  }

  return (
    <div className="flex min-h-screen bg-page text-page">

      {/* MODAL DE CONFLITO */}
      {conflito && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-surface border border-default rounded-2xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#F59E0B]/15 flex items-center justify-center shrink-0 mt-0.5">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white">Sugestão automática pendente</h3>
                <p className="text-sm text-muted mt-1">
                  Já existe uma sugestão gerada automaticamente pelo sistema para esta violação em{" "}
                  <span className="text-white font-medium">
                    {new Date(conflito.dataReferencia).toLocaleDateString("pt-BR")}
                  </span>.
                </p>
                <p className="text-sm text-muted mt-2">
                  Ao continuar, a sugestão automática será <span className="text-[#EF4444] font-medium">rejeitada</span> e a MD manual será criada no lugar.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setConflito(null)}
                className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-[#3A3A3C] text-sm cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarSobreporSugestao}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#FA4C00] hover:bg-[#e64500] active:scale-95 text-sm cursor-pointer transition-all disabled:opacity-50"
              >
                {saving ? "Criando..." : "Criar MD manual e rejeitar sugestão"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <MainLayout>

        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 max-w-5xl mx-auto space-y-8">

          {/* HEADER */}

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-4">

              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg bg-surface hover:bg-surface-2"
              >
                <ArrowLeft size={18} />
              </button>

              <div>
                <h1 className="text-2xl font-semibold">
                  Nova Medida Disciplinar
                </h1>

                <p className="text-sm text-muted">
                  Registro manual de medida disciplinar
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

              {saving ? "Salvando..." : "Criar Medida"}

            </button>

          </div>

          {/* CPF */}

          <Section title="Identificação do Colaborador">

            <Input
              label="CPF do Colaborador"
              name="cpf"
              value={form.cpf}
              onChange={handleChange}
              onBlur={buscarColaborador}
              placeholder="000.000.000-00"
            />

            {erroCpf && (
              <p className="text-sm text-red-400 md:col-span-2">
                {erroCpf}
              </p>
            )}

          </Section>

          {colaborador && (
            <>

              <Section title="Dados Pessoais">

                <ReadOnly label="Nome" value={colaborador.nomeCompleto} />
                <ReadOnly label="CPF" value={colaborador.cpf} />
                <ReadOnly label="E-mail" value={colaborador.email} />
                <ReadOnly label="Telefone" value={colaborador.telefone} />
                <ReadOnly label="Matrícula" value={colaborador.matricula} />
                <ReadOnly label="Gênero" value={colaborador.genero} />

              </Section>

              <Section title="Vínculo Organizacional">

                <ReadOnly label="Empresa" value={colaborador.empresa?.razaoSocial} />
                <ReadOnly label="Setor" value={colaborador.setor?.nomeSetor} />
                <ReadOnly label="Cargo" value={colaborador.cargo?.nomeCargo} />
                <ReadOnly label="Turno" value={colaborador.turno?.nomeTurno} />

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
              type="date"
              label="Data da Ocorrência"
              name="dataOcorrencia"
              value={form.dataOcorrencia}
              onChange={handleChange}
            />

            <Select
              label="Nível da Violação"
              name="nivelViolacao"
              value={form.nivelViolacao}
              onChange={handleChange}
              options={NIVEIS_VIOLACAO}
            />

            <Select
              label="Tipo da Medida"
              name="tipoMedida"
              value={form.tipoMedida}
              onChange={handleChange}
              options={TIPOS_MEDIDA}
            />

            {form.tipoMedida === "SUSPENSAO" && (
              <Input
                type="number"
                label="Dias de Suspensão"
                name="diasSuspensao"
                value={form.diasSuspensao}
                onChange={handleChange}
              />
            )}

            <Textarea
              label="Violação"
              name="violacao"
              value={form.violacao}
              onChange={handleChange}
            />

            <Textarea
              label="Motivo da Medida"
              name="motivo"
              value={form.motivo}
              onChange={handleChange}
            />

          </Section>

        </main>

      </MainLayout>

    </div>
  );

}

/* ================= COMPONENTES ================= */

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
        className="px-4 py-2.5 bg-surface-2 border border-default
        rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      />
    </div>
  );
}

function Select({ label, options = [], ...props }) {
  return (
    <div className="flex flex-col gap-1">

      <label className="text-xs text-muted">{label}</label>

      <select
        {...props}
        className="px-4 py-2.5 bg-surface-2 border border-default
        rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      >

        <option value="">Selecione</option>

        {options.map(o => (
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
        {...props}
        rows={3}
        className="px-4 py-2.5 bg-surface-2 border border-default
        rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      />

    </div>
  );
}

function ReadOnly({ label, value }) {
  return (
    <div className="flex flex-col gap-1">

      <label className="text-xs text-muted">{label}</label>

      <div className="px-4 py-2.5 bg-[#1E1E20] border border-[#2F2F33] rounded-xl text-sm">
        {value || "-"}
      </div>

    </div>
  );
}