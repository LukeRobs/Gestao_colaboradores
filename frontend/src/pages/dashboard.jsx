import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Clock, Building2, TrendingUp } from "lucide-react";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import StatCard from "../components/StatCard";

import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [turnoSelecionado, setTurnoSelecionado] = useState("T1");

  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await api.get("/dashboard");
        setDados(res.data.data);
      } catch (err) {
        if (err.response?.status === 401) {
          logout();
          navigate("/login");
        } else {
          setErro("Erro ao carregar dashboard.");
        }
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [logout, navigate]);

  if (loading) return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  if (erro) return <div className="flex items-center justify-center h-screen text-red-600">{erro}</div>;
  if (!dados) return <div className="flex items-center justify-center h-screen text-red-600">Dados vazios.</div>;

  // ----------------- FILTRAR POR TURNO -----------------
  const colaboradoresDoTurno = (dados.colaboradores || []).filter(
    (c) => (c.turno || "T1") === turnoSelecionado
  );

  // ----------------- ABSENTEÍSMO -----------------
  const idsAusentes = new Set((dados.ausenciasHoje || []).map(a => a.colaboradorId));
  const ausentes = colaboradoresDoTurno.filter(c => idsAusentes.has(c.id)).length;
  const presentes = colaboradoresDoTurno.length - ausentes;

  const totalColaboradores = colaboradoresDoTurno.length;
  const absenteismo = totalColaboradores
    ? `${((ausentes / totalColaboradores) * 100).toFixed(1)}%`
    : "0%";

  const stats = [
    { title: "Total de Colaboradores", value: totalColaboradores, icon: Users },
    { title: "Presentes Hoje", value: presentes, icon: Clock },
    { title: "Absenteísmo", value: absenteismo, icon: TrendingUp },
    { title: "Unidades / Empresas", value: dados.empresas?.length || 0, icon: Building2 },
  ];

  // ----------------- EMPRESAS -----------------
  const empresasData = (dados.empresas || []).map(emp => ({
    ...emp,
    qtd: colaboradoresDoTurno.filter(
      c => (c.empresa || "").trim() === (emp.nome || "").trim()
    ).length
  }));

  // ----------------- GÊNERO -----------------
  const generoData = Object.entries(
    colaboradoresDoTurno.reduce((acc, c) => {
      acc[c.genero || "Não informado"] = (acc[c.genero || "Não informado"] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const COLORS = ["#8884d8", "#82ca9d", "#ffc658"];

  // ----------------- STATUS -----------------
  const statusData = colaboradoresDoTurno.reduce((acc, c) => {
    acc[c.status || "Desconhecido"] = (acc[c.status || "Desconhecido"] || 0) + 1;
    return acc;
  }, {});

  const listaAusentes = dados.ausenciasHoje || [];

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 relative">
      {/* SIDEBAR */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex-1 lg:ml-64 transition-all duration-300">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 space-y-10">

          {/* -------------------- FILTRO DE TURNO -------------------- */}
          <div className="flex gap-3 mb-6">
            {["T1", "T2", "T3"].map((t) => (
              <button
                key={t}
                onClick={() => setTurnoSelecionado(t)}
                className={`px-4 py-2 rounded-xl font-medium ${
                  turnoSelecionado === t
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* -------------------- TOP CARDS -------------------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <StatCard key={i} {...stat} />
            ))}
          </div>

          {/* -------------------- EMPRESAS -------------------- */}
          <section>
            <h2 className="text-lg font-bold mb-4">Quantidade por Empresa</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {empresasData.map((emp, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800"
                >
                  <p className="font-medium">{emp.nome}</p>
                  <p className="text-2xl font-bold mt-1">{emp.qtd}</p>
                </div>
              ))}
            </div>
          </section>

          {/* -------------------- GRÁFICOS -------------------- */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GÊNERO */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border">
              <h2 className="text-lg font-bold mb-4">Quantidade por Gênero</h2>

              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={generoData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                    label
                  >
                    {generoData.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* STATUS */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border">
              <h2 className="text-lg font-bold mb-4">Status dos Colaboradores</h2>

              {Object.entries(statusData).map(([status, qtd], i) => (
                <div key={i} className="flex justify-between py-2">
                  <span>{status}</span>
                  <span className="font-bold">{qtd}</span>
                </div>
              ))}
            </div>
          </section>

          {/* -------------------- AUSENTES -------------------- */}
          <section>
            <h2 className="text-lg font-bold mb-4">Ausentes Hoje</h2>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border p-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="py-2">Colaborador</th>
                    <th className="py-2">Motivo</th>
                    <th className="py-2">Turno</th>
                  </tr>
                </thead>
                <tbody>
                  {listaAusentes.map((a, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-3">{a.nome}</td>
                      <td className="py-3">{a.motivo}</td>
                      <td className="py-3">{a.turno || "Sem turno"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
