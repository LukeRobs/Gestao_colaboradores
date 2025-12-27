import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Shuffle,
  Trash2,
  User,
  FileText,
} from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { Badge } from "../../components/UIComponents";
import api from "../../services/api";

export default function PerfilColaborador() {
  const { opsId } = useParams();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [colaborador, setColaborador] = useState(null);
  const [medidas, setMedidas] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [colabRes, mdRes] = await Promise.all([
          api.get(`/colaboradores/${opsId}`),
          api.get(`/medidas-disciplinares?opsId=${opsId}`),
        ]);

        setColaborador(colabRes.data.data);
        setMedidas(mdRes.data.data || []);
      } catch (err) {
        console.error(err);
        alert("Erro ao carregar perfil do colaborador");
        navigate("/colaboradores");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [opsId, navigate]);

  async function handleDelete() {
    if (!window.confirm("Tem certeza que deseja excluir este colaborador?")) return;
    await api.delete(`/colaboradores/${opsId}`);
    navigate("/colaboradores");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] text-[#BFBFC3]">
        Carregando perfil…
      </div>
    );
  }

  const indicadoresAtestado = colaborador.indicadores?.atestados || {
    total: 0,
    ativos: 0,
    finalizados: 0,
  };

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 max-w-6xl mx-auto space-y-8">

          {/* HEADER PERFIL */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/colaboradores")}
                className="p-2 rounded-lg bg-[#1A1A1C] hover:bg-[#2A2A2C]"
              >
                <ArrowLeft size={18} />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#2A2A2C] flex items-center justify-center">
                  <User size={28} />
                </div>

                <div>
                  <h1 className="text-2xl font-semibold">
                    {colaborador.nomeCompleto}
                  </h1>
                  <p className="text-sm text-[#BFBFC3]">
                    OPS ID: {colaborador.opsId}
                  </p>
                </div>
              </div>
            </div>

            <Badge.Status
              variant={colaborador.status === "ATIVO" ? "success" : "danger"}
            >
              {colaborador.status}
            </Badge.Status>
          </div>

          {/* AÇÕES */}
          <div className="flex gap-3">
            <ActionButton
              icon={<Pencil size={16} />}
              label="Editar"
              onClick={() => navigate(`/colaboradores/${opsId}/editar`)}
            />

            <ActionButton
              icon={<Shuffle size={16} />}
              label="Movimentar"
              onClick={() => navigate(`/colaboradores/${opsId}/movimentar`)}
            />

            <ActionButton
              icon={<Trash2 size={16} />}
              label="Excluir"
              danger
              onClick={handleDelete}
            />
          </div>

          {/* DADOS */}
          <Section title="Dados Pessoais">
            <Info label="CPF" value={colaborador.cpf} />
            <Info label="E-mail" value={colaborador.email} />
            <Info label="Telefone" value={colaborador.telefone} />
            <Info label="Gênero" value={colaborador.genero} />
            <Info label="Matrícula" value={colaborador.matricula} />
          </Section>

          <Section title="Vínculo Organizacional">
            <Info label="Empresa" value={colaborador.empresa?.razaoSocial} />
            <Info label="Setor" value={colaborador.setor?.nomeSetor} />
            <Info label="Cargo" value={colaborador.cargo?.nomeCargo} />
            <Info label="Turno" value={colaborador.turno?.nomeTurno} />
          </Section>

          <Section title="Jornada">
            <Info
              label="Data de Admissão"
              value={
                colaborador.dataAdmissao
                  ? new Date(colaborador.dataAdmissao).toLocaleDateString()
                  : "-"
              }
            />
            <Info
              label="Início da Jornada"
              value={
                colaborador.horarioInicioJornada
                  ? colaborador.horarioInicioJornada.substring(11, 16)
                  : "-"
              }
            />
          </Section>

          {/* INDICADORES DE SAÚDE */}
          <Section title="Indicadores de Saúde">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Indicator label="Atestados" value={indicadoresAtestado.total} />
              <Indicator
                label="Ativos"
                value={indicadoresAtestado.ativos}
                color="text-yellow-400"
              />
              <Indicator
                label="Finalizados"
                value={indicadoresAtestado.finalizados}
                color="text-green-400"
              />
            </div>
          </Section>

          {/* MEDIDAS DISCIPLINARES */}
          <Section title="Medidas Disciplinares">
            <div className="md:col-span-2 space-y-4">

              <Indicator
                label="Total de Medidas"
                value={medidas.length}
                color="text-orange-400"
              />

              {medidas.length === 0 && (
                <p className="text-sm text-[#BFBFC3]">
                  Nenhuma medida disciplinar registrada.
                </p>
              )}

              {medidas.map((md) => (
                <div
                  key={md.idMedida}
                  className="flex items-start gap-4 bg-[#0D0D0D] border border-[#3D3D40] rounded-xl p-4"
                >
                  <FileText size={18} className="text-orange-400 mt-1" />

                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      {md.tipoMedida}
                    </p>
                    <p className="text-xs text-[#BFBFC3]">
                      {new Date(md.dataAplicacao).toLocaleDateString()}
                    </p>
                    <p className="text-sm mt-2">
                      {md.motivo}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

        </main>
      </div>
    </div>
  );
}

/* ================= COMPONENTES ================= */

function Section({ title, children }) {
  return (
    <div className="bg-[#1A1A1C] border border-[#3D3D40] rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-[#BFBFC3] mb-6 uppercase">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-[#BFBFC3]">{label}</p>
      <p className="text-sm font-medium">{value || "-"}</p>
    </div>
  );
}

function Indicator({ label, value, color = "text-white" }) {
  return (
    <div className="bg-[#0D0D0D] border border-[#3D3D40] rounded-xl p-4">
      <p className="text-xs text-[#BFBFC3] uppercase">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function ActionButton({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-2
        px-4 py-2 rounded-lg
        transition cursor-pointer
        ${
          danger
            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
            : "bg-[#1A1A1C] hover:bg-[#2A2A2C]"
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}
