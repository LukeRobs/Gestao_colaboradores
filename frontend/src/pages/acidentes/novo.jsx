// src/pages/acidentes/novo.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Upload, Image as ImageIcon } from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";
import { AcidentesAPI } from "../../services/acidentes";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "image/heic",
  "image/heif",
  "application/pdf",
];

function isImageType(type) {
  return ACCEPTED_TYPES.includes(type);
}

export default function NovoAcidente() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // registrador
  const [registrador, setRegistrador] = useState(null);

  // colaborador acidentado
  const [colaborador, setColaborador] = useState(null);
  const [erroOps, setErroOps] = useState("");

  const [form, setForm] = useState({
    cpf: "",
    participouIntegracao: "false",
    tipoOcorrencia: "",
    dataOcorrencia: "",
    horarioOcorrencia: "",
    dataComunicacaoHSE: "",
    localOcorrencia: "",
    situacaoGeradora: "",
    agenteCausador: "",
    parteCorpoAtingida: "",
    lateralidade: "",
    tipoLesao: "",
    acoesImediatas: "",
  });


  const [fotos, setFotos] = useState([]); // File[]
  const fotosCount = fotos.length;

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const me = await AcidentesAPI.me();
        if (mounted) setRegistrador(me);
      } catch (err) {
        // se seu backend não tiver /auth/me, ignora sem quebrar
        console.warn("Sem /auth/me, registrador ficará vazio.", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // 🔎 busca colaborador ao sair do campo (onBlur) e também se apertar Enter
  async function buscarColaborador() {
    const cpfLimpo = form.cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      setColaborador(null);
      setErroOps("CPF inválido");
      return;
    }

    try {
      const res = await api.get(`/colaboradores/cpf/${cpfLimpo}`);
      setColaborador(res.data.data);
      setErroOps("");
    } catch {
      setColaborador(null);
      setErroOps("Colaborador não encontrado");
    }
  }


  function handleFotosChange(filesList) {
    const files = Array.from(filesList || []);
    if (!files.length) return;

    const next = [...fotos, ...files].slice(0, 5);

    const invalid = next.find((f) => !isImageType(f.type));
    if (invalid) {
      alert(`Arquivo inválido: ${invalid.name}`);
      return;
    }

    setFotos(next);
  }


  const podeSalvar = useMemo(() => {
    const cpfLimpo = form.cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) return false;
    if (!colaborador) return false;

    if (!form.tipoOcorrencia) return false;
    if (!form.dataOcorrencia) return false;
    if (!form.horarioOcorrencia) return false;
    if (!form.dataComunicacaoHSE) return false;
    if (!form.localOcorrencia) return false;
    if (!form.situacaoGeradora) return false;
    if (!form.agenteCausador) return false;
    if (!form.parteCorpoAtingida) return false;
    if (!form.lateralidade) return false;
    if (!form.tipoLesao) return false;
    if (!form.acoesImediatas) return false;
    if (fotos.length < 1) return false;

    return true;
  }, [colaborador, form, fotos.length]);

    async function handleSave() {
      if (!podeSalvar || saving || uploading) return;

      const cpfLimpo = form.cpf.replace(/\D/g, "");

      try {
        setSaving(true);

        /* 1️⃣ Upload das fotos */
        setUploading(true);

        const uploadedKeys = [];

        for (const file of fotos) {
          const fileInfo = {
            filename: file.name,
            contentType: file.type,
            size: file.size,
          };

          const presignResponse = await AcidentesAPI.presignUpload({
            cpf: cpfLimpo,
            files: [fileInfo],
          });

          const { uploadUrl, key } = presignResponse[0];

          const put = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });

          const text = await put.text().catch(() => "");
          console.log("[UPLOAD]", file.name, {
            status: put.status,
            ok: put.ok,
            uploadUrl,
            resp: text?.slice(0, 500),
          });

          if (!put.ok) {
            throw new Error(`Falha ao enviar imagem (${put.status}): ${text || file.name}`);
          }

          uploadedKeys.push(key);
        }

        setUploading(false);
        console.log("Payload acidente:", {
        cpf: cpfLimpo,
        nomeRegistrante: registrador?.name || "Sistema",
        setor: colaborador?.setor?.nomeSetor || "",
        cargo: colaborador?.cargo?.nomeCargo || "",
        evidencias: uploadedKeys,
      });
        /* 2️⃣ Criação do acidente */
      const created = await AcidentesAPI.criar({
        cpf: cpfLimpo,
        nomeRegistrante: registrador?.name || "Sistema",
        setor: colaborador?.setor?.nomeSetor || "",
        cargo: colaborador?.cargo?.nomeCargo || "",
        participouIntegracao: form.participouIntegracao === "true",
        tipoOcorrencia: form.tipoOcorrencia,
        dataOcorrencia: form.dataOcorrencia,
        horarioOcorrencia: form.horarioOcorrencia,
        dataComunicacaoHSE: form.dataComunicacaoHSE,
        localOcorrencia: form.localOcorrencia,
        situacaoGeradora: form.situacaoGeradora,
        agenteCausador: form.agenteCausador,
        parteCorpoAtingida: form.parteCorpoAtingida,
        lateralidade: form.lateralidade,
        tipoLesao: form.tipoLesao,
        acoesImediatas: form.acoesImediatas,
        evidencias: uploadedKeys,
      });

      console.log("Acidente Criado:", created);
      navigate("/acidentes");
      } catch (err) {
        console.error("Erro ao salvar acidente:", err);
        alert("Erro ao salvar acidente.");
      } finally {
        setUploading(false);
        setSaving(false);
      }
    }


  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <div className="flex-1 lg:ml-64">
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
                <h1 className="text-2xl font-semibold">Novo Acidente</h1>
                <p className="text-sm text-muted">
                  Registro de ocorrência + evidências (1–5 fotos)
                </p>
              </div>
            </div>

            <button
              disabled={saving || uploading || !podeSalvar}
              onClick={handleSave}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium
                ${saving || uploading || !podeSalvar
                  ? "bg-[#FA4C00]/50 cursor-not-allowed"
                  : "bg-[#FA4C00] hover:bg-[#ff5a1a]"
                }
              `}
            >
              <Save size={16} />
              {uploading
                ? "Enviando fotos..."
                : saving
                ? "Salvando..."
                : "Salvar"}
            </button>

          </div>

          {/* Seção 1: Identificação */}
          <Section title="Identificação">
          <Input
            label="CPF do Colaborador Acidentado *"
            name="cpf"
            value={form.cpf}
            onChange={(e) => {
              setForm((p) => ({ ...p, cpf: e.target.value }));
              setErroOps("");
              setColaborador(null);
            }}
            onBlur={buscarColaborador}
            placeholder="000.000.000-00"
          />


            {erroOps ? (
              <div className="md:col-span-2 text-sm text-red-400">{erroOps}</div>
            ) : null}

            {/* Dados do colaborador acidentado */}
            {colaborador ? (
              <div className="md:col-span-2 bg-page border border-default rounded-xl p-4">
                <p className="text-xs uppercase text-muted">
                  Dados do colaborador
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <Info label="Nome" value={colaborador.nomeCompleto} />
                  <Info label="Matrícula" value={colaborador.matricula} />
                  <Info label="Setor" value={colaborador.setor?.nomeSetor} />
                  <Info label="Cargo" value={colaborador.cargo?.nomeCargo} />
                  <Info label="Empresa" value={colaborador.empresa?.razaoSocial} />
                  <Info label="Turno" value={colaborador.turno?.nomeTurno} />
                </div>
              </div>
            ) : form.cpf.replace(/\D/g, "").length === 11 ? (
              <div className="md:col-span-2 text-sm text-yellow-400">
                Carregando dados do colaborador...
              </div>
            ) : (
              <div className="md:col-span-2 text-xs text-muted">
                Digite o CPF e saia do campo para carregar os dados do colaborador.
              </div>
            )}


            <Select
              label="Participou da Integração? *"
              name="participouIntegracao"
              value={form.participouIntegracao}
              onChange={handleChange}
              options={[
                { value: "false", label: "Não" },
                { value: "true", label: "Sim" },
              ]}
            />

            <Select
              label="Tipo de Ocorrência *"
              name="tipoOcorrencia"
              value={form.tipoOcorrencia}
              onChange={handleChange}
              options={[
                { value: "", label: "Selecione..." },
                { value: "Ocorrencia Tipica - a servico da empresa", label: "Ocorrência Típica (a serviço da empresa)" },
                { value: "Ocorrencia de trajeto - de casa para o trabalho ou vice e versa", label: "Ocorrência de Trajeto (casa ↔ trabalho)" },
              ]}
            />
          </Section>

          {/* Seção 2: Dados do evento */}
          <Section title="Dados do Evento">
            <Input
              type="date"
              label="Data da Ocorrência *"
              name="dataOcorrencia"
              value={form.dataOcorrencia}
              onChange={handleChange}
            />
            <Input
              type="time"
              label="Horário da Ocorrência *"
              name="horarioOcorrencia"
              value={form.horarioOcorrencia}
              onChange={handleChange}
            />

            <Input
              type="date"
              label="Data de Comunicação ao HSE *"
              name="dataComunicacaoHSE"
              value={form.dataComunicacaoHSE}
              onChange={handleChange}
            />

            <Input
              label="Local da Ocorrência *"
              name="localOcorrencia"
              value={form.localOcorrencia}
              onChange={handleChange}
              placeholder="Ex: Docas, Rua 20, Expedição..."
            />

            <Input
              label="Situação Geradora *"
              name="situacaoGeradora"
              value={form.situacaoGeradora}
              onChange={handleChange}
              placeholder="Ex: Queda ao caminhar, esforço repetitivo..."
            />

            <Input
              label="Agente Causador *"
              name="agenteCausador"
              value={form.agenteCausador}
              onChange={handleChange}
              placeholder="Ex: Piso molhado, gaiola, palete, escada..."
            />
          </Section>

          {/* Seção 3: Lesão */}
          <Section title="Lesão">
            <Input
              label="Parte do Corpo Atingida *"
              name="parteCorpoAtingida"
              value={form.parteCorpoAtingida}
              onChange={handleChange}
              placeholder="Ex: Mão, pé, lombar..."
            />

            <Select
              label="Lateralidade *"
              name="lateralidade"
              value={form.lateralidade}
              onChange={handleChange}
              options={[
                { value: "", label: "Selecione..." },
                { value: "Direita", label: "Direita" },
                { value: "Esquerda", label: "Esquerda" },
                { value: "Ambas", label: "Ambas" },
                { value: "Não se aplica", label: "Não se aplica" },
              ]}
            />

            <Input
              label="Tipo da Lesão *"
              name="tipoLesao"
              value={form.tipoLesao}
              onChange={handleChange}
              placeholder="Ex: Contusão, corte, distensão..."
            />

            <Textarea
              label="Descreva ações imediatas *"
              name="acoesImediatas"
              value={form.acoesImediatas}
              onChange={handleChange}
              placeholder="O que foi feito no momento? (primeiros socorros, comunicação, isolamento, etc.)"
            />
          </Section>

          {/* Seção 4: Evidências */}
          <Section title="Evidências (Fotos)">
            <div className="md:col-span-2">
              <label className="text-xs text-muted">
                Fotos (1 a 5) * — JPG/PNG/WEBP/HEIC
              </label>

              <label
                className="
                  mt-1 flex items-center gap-3 px-4 py-3
                  bg-surface-2 border border-default
                  rounded-xl cursor-pointer hover:bg-surface-3
                "
              >
                <Upload size={16} className="text-muted" />
                <span className="text-sm text-white">
                  {fotosCount ? `${fotosCount} foto(s) selecionada(s)` : "Selecionar fotos"}
                </span>

                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFotosChange(e.target.files)}
                />
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                {fotos.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-page border border-default rounded-lg"
                  >
                    <ImageIcon size={16} className="text-muted" />
                    <span className="text-xs text-white">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-muted hover:text-white"
                      title="Remover"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted mt-2">
                Dica: selecione no máximo 5 fotos. Se passar, o sistema mantém apenas as 5 primeiras.
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
    <div className="bg-surface border border-default rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-muted mb-6 uppercase">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{children}</div>
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
        {...props}
        rows={4}
        className="px-4 py-2.5 bg-surface-2 border border-default rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-medium text-white">{value || "-"}</p>
    </div>
  );
}