import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, LayoutDashboard, Clock, Building2, Briefcase, Layers,
  FileText, Settings, Menu, X, User, LogOut, Sun, Moon, TrendingUp
} from "lucide-react";
import { ThemeContext } from "../context/ThemeContext";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// ----------------- SIDEBAR -----------------
function Sidebar({ isOpen, onClose, navigate }) {
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', active: true },
    { icon: Users, label: 'Colaboradores', path: '/colaboradores' },
    { icon: Clock, label: 'Ponto', path: '/ponto' },
    { icon: Building2, label: 'Empresas', path: '/empresas' },
    { icon: Layers, label: 'Departamentos', path: '/departamentos' },
    { icon: Briefcase, label: 'Cargos', path: '/cargos' },
    { icon: FileText, label: 'Relatórios', path: '/relatorios' },
    { icon: Settings, label: 'Configurações', path: '/configuracoes' },
  ];

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 w-64 z-50 transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">Gestão RH</span>
          </div>
          <button onClick={onClose} className="lg:hidden">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {menuItems.map((item, index) => (
            <button key={index} onClick={() => navigate(item.path)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${item.active ? "bg-blue-600 text-white shadow-lg" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}

// ----------------- HEADER -----------------
function Header({ onMenuClick }) {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const { isDark, setIsDark } = useContext(ThemeContext);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="hidden lg:block">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Bem-vindo de volta!</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          {isDark ? <Sun /> : <Moon />}
        </button>
        <div className="relative">
          <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.nome}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user?.papel}</p>
            </div>
          </button>
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg py-2 z-50">
              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="w-full text-left px-4 py-2 flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <LogOut className="w-4 h-4" /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ----------------- STAT CARD -----------------
function StatCard({ title, value, icon: Icon }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-all">
      <div className="p-3 bg-blue-600 rounded-xl inline-block mb-4">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
    </div>
  );
}

// ----------------- DASHBOARD -----------------
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
        const res = await api.get("/api/dashboard");
        console.log("📦 Dados recebidos do backend:", res.data.data);  // ← ADICIONADO: Debug dos dados
        setDados(res.data.data);
      } catch (err) {
        console.error("❌ Erro no fetch:", err);  // ← ADICIONADO: Mais detalhes no erro
        if (err.response && err.response.status === 401) {
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
  }, [logout, navigate]);  // ← ADICIONADO: Dependências para evitar warnings

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-700 dark:text-gray-300">Carregando dashboard...</div>;
  if (erro) return <div className="flex items-center justify-center h-screen text-red-600">{erro}</div>;
  if (!dados) return <div className="flex items-center justify-center h-screen text-red-600">Dados do dashboard estão vazios.</div>;

  // ----------------- FILTRAR COLABORADORES POR TURNO -----------------
  const colaboradoresDoTurno = (dados.colaboradores || []).filter(c => (c.turno || "T1") === turnoSelecionado);

  // ----------------- CALCULAR AUSENTES COM BASE EM AUSÊNCIAS DE HOJE -----------------
  const idsAusentes = new Set((dados?.ausenciasHoje || []).map(a => a.colaboradorId));  // Set de opsId ausentes
  const ausentes = colaboradoresDoTurno.filter(c => idsAusentes.has(c.id)).length;  // c.id é opsId
  const presentes = colaboradoresDoTurno.length - ausentes;  // Abate ausentes do total

  // ----------------- STATS -----------------
  const totalColaboradores = colaboradoresDoTurno.length;
  const absenteismo = totalColaboradores
    ? (((ausentes / totalColaboradores) * 100).toFixed(1) + "%")
    : "0%";

  const stats = [
    { title: "Total de Colaboradores", value: totalColaboradores, icon: Users },
    { title: "Presentes Hoje", value: presentes, icon: Clock },
    { title: "Absenteísmo", value: absenteismo, icon: TrendingUp },
    { title: "Unidades / Empresas", value: dados?.empresas?.length || 0, icon: Building2 },
  ];

  // Debug temporário (remova depois de testar):
  console.log("🔍 Debug ausências:", { 
    totalColaboradores, 
    ausentes, 
    presentes, 
    idsAusentes: Array.from(idsAusentes).slice(0, 5),  // Primeiros 5 IDs
    ausenciasHoje: dados?.ausenciasHoje?.length || 0 
  });

  // ----------------- QUANTIDADE POR EMPRESA -----------------
  const empresasData = (dados?.empresas || []).map(emp => ({
    ...emp,
    qtd: colaboradoresDoTurno.filter(c => (c.empresa || "").trim() === (emp.nome || "").trim()).length
  }));

  // ----------------- QUANTIDADE POR GÊNERO -----------------
  const generoData = Object.entries(
    colaboradoresDoTurno.reduce((acc, c) => {
      const g = c.genero || "Não informado";
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const COLORS = ["#8884d8", "#82ca9d", "#ffc658"];

  // ----------------- STATUS -----------------
  const statusData = colaboradoresDoTurno.reduce((acc, c) => {
    const s = c.status || "Desconhecido";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  // ----------------- AUSENTES -----------------
  const listaAusentes = dados?.ausenciasHoje || [];  // ← RENOMEADO: Evita conflito com 'ausentes' (número)

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />
      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6 space-y-10">

          {/* ----------------- FILTRO DE TURNO ----------------- */}
          <div className="flex gap-3 mb-6">
            {["T1", "T2", "T3"].map(t => (
              <button
                key={t}
                onClick={() => setTurnoSelecionado(t)}
                className={`px-4 py-2 rounded-xl font-medium ${turnoSelecionado === t ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ----------------- TOP STATS ----------------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => <StatCard key={i} {...stat} />)}
          </div>

          {/* ----------------- QUANTIDADE POR EMPRESA ----------------- */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quantidade por Empresa</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {empresasData.map((emp, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
                  <p className="text-gray-700 dark:text-gray-300 font-medium">{emp.nome}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{emp.qtd}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ----------------- GÊNERO + STATUS ----------------- */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quantidade por Gênero</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={generoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50} label>
                    {generoData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Status dos Colaboradores</h2>
              <div className="space-y-3">
                {Object.entries(statusData).map(([status, qtd], i) => (
                  <div key={i} className="flex justify-between text-gray-700 dark:text-gray-300">
                    <span>{status}</span>
                    <span className="font-bold">{qtd}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ----------------- AUSENTES ----------------- */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Ausentes Hoje</h2>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                    <th className="py-2">Colaborador</th>
                    <th className="py-2">Motivo</th>
                    <th className="py-2">Turno</th>
                  </tr>
                </thead>
                <tbody>
                  {listaAusentes.map((a, i) => (
                    <tr key={i} className="text-gray-800 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800">
                      <td className="py-3">{a.nome}</td>
                      <td className="py-3">{a.motivo}</td>
                      <td className="py-3">{a.turno || "Sem Turno"}</td>
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