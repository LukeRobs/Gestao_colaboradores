import {
  LayoutDashboard,
  Users,
  Clock,
  Layers,
  Network,
  FileText,
  Settings,
  Upload,
  ChevronDown,
  X,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useContext, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";
import { EstacoesAPI } from "../services/estacoes";

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, permissions } = useContext(AuthContext);
  const { isCollapsed, setIsCollapsed } = useSidebar();

  const isAdmin = permissions?.isAdmin;
  const isAltaGestao = permissions?.isAltaGestao;
  const isLideranca = permissions?.isLideranca;
  const isGlobal = isAdmin || isAltaGestao;

  const [nomeEstacao, setNomeEstacao] = useState(null);

  useEffect(() => {
    if (user?.idEstacao) {
      EstacoesAPI.listar()
        .then((lista) => {
          const found = lista.find((e) => e.idEstacao === user.idEstacao);
          setNomeEstacao(found?.nomeEstacao || null);
        })
        .catch(() => {});
    }
  }, [user?.idEstacao]);

  // OPERACAO não vê sidebar
  if (user?.role === "OPERACAO") {
    return null;
  }

  /* =====================
     SUBMENUS
  ===================== */
  const [dashboardsOpen, setDashboardsOpen] = useState(
    location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/spi")
  );

  const [organizacaoOpen, setOrganizacaoOpen] = useState(
    ["/empresas", "/regionais", "/estacoes", "/setores", "/cargos", "/turnos", "/escalas"].some((p) =>
      location.pathname.startsWith(p)
    )
  );
  const [dwOpen, setDwOpen] = useState(location.pathname.startsWith("/dw"));
  const [pontoOpen, setPontoOpen] = useState(location.pathname.startsWith("/ponto"));
  const [medidasOpen, setMedidasOpen] = useState(location.pathname.startsWith("/medidas-disciplinares"));
  const [gestaoOpen, setGestaoOpen] = useState(location.pathname.startsWith("/treinamentos"));

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const go = (path) => {
    navigate(path);
    onClose?.();
  };

  /* =====================
     MENU PRINCIPAL
  ===================== */
  const menuItems = [
    { icon: Users, label: "Colaboradores", path: "/colaboradores" },
    ...(isGlobal || isLideranca
      ? [
          { icon: FileText, label: "Atestados Médicos", path: "/atestados" },
          { icon: Settings, label: "Acidentes", path: "/acidentes" },
        ]
      : []),
    ...(isGlobal
      ? [{ icon: Upload, label: "Importar colaboradores", path: "/colaboradores/import" }]
      : []),
  ];

  // Classes reutilizáveis para label e chevron com fade ao recolher
  const labelCls = `transition-all duration-200 overflow-hidden whitespace-nowrap ${
    isCollapsed ? "lg:max-w-0 lg:opacity-0" : "max-w-xs opacity-100"
  }`;
  const chevronCls = (open) =>
    `shrink-0 transition-all duration-200 ${open ? "rotate-180" : ""} ${
      isCollapsed ? "lg:w-0 lg:opacity-0 lg:overflow-hidden" : "opacity-100"
    }`;

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full bg-surface z-50
          flex flex-col
          transform transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${isCollapsed ? "lg:w-20" : "lg:w-64"}
          w-64
        `}
      >
        {/* Header */}
        <div
          className={`h-16 flex items-center shrink-0 border-b border-default transition-all duration-300 ${
            isCollapsed ? "justify-center px-3" : "justify-between px-6"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-[#FA4C00] shrink-0" />
            <div
              className={`flex flex-col leading-tight overflow-hidden transition-all duration-300 ease-in-out ${
                isCollapsed ? "lg:max-w-0 lg:opacity-0" : "max-w-[140px] opacity-100"
              }`}
            >
              <span className="font-semibold text-page tracking-wide whitespace-nowrap">
                COPEOPLE
              </span>
              {nomeEstacao && (
                <span className="text-[10px] text-[#FA4C00] truncate">
                  {nomeEstacao}
                </span>
              )}
            </div>
          </div>

          {/* Toggle Button (Desktop only) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:bg-surface-3 transition shrink-0"
            title={isCollapsed ? "Expandir" : "Recolher"}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>

          {/* Close button (Mobile only) */}
          <button onClick={onClose} className="lg:hidden text-muted">
            <X size={18} />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1 flex-1 overflow-y-auto scrollbar-hide">

          {/* ===================== DASHBOARDS ===================== */}
          <div>
            <button
              onClick={() => setDashboardsOpen(!dashboardsOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition ${
                location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/spi")
                  ? "bg-surface-2 text-page"
                  : "text-muted hover:bg-surface-3"
              } ${isCollapsed ? "lg:justify-center" : ""}`}
              title={isCollapsed ? "Dashboards" : ""}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={18} />
                <span className={labelCls}>Dashboards</span>
              </div>
              <ChevronDown size={16} className={chevronCls(dashboardsOpen)} />
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                dashboardsOpen && !isCollapsed ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="ml-8 mt-1 space-y-1">
                <SidebarSubItem
                  label="Operacional"
                  active={isActive("/dashboard/operacional")}
                  onClick={() => go("/dashboard/operacional")}
                />
                {(isGlobal || isLideranca) && (
                  <>
                    {(isAdmin || user?.idEstacao === 1) && (
                      <>
                        <SidebarSubItem
                          label="Gestão Operacional"
                          active={isActive("/dashboard/gestao-operacional")}
                          onClick={() => go("/dashboard/gestao-operacional")}
                        />
                        <SidebarSubItem
                          label="Produtividade por Colaborador"
                          active={isActive("/dashboard/produtividade-colaborador")}
                          onClick={() => go("/dashboard/produtividade-colaborador")}
                        />
                        <SidebarSubItem
                          label="SPI"
                          active={isActive("/spi")}
                          onClick={() => go("/spi")}
                        />
                      </>
                    )}
                    <SidebarSubItem
                      label="Atestados"
                      active={isActive("/dashboard/atestados")}
                      onClick={() => go("/dashboard/atestados")}
                    />
                    <SidebarSubItem
                      label="Absenteísmo"
                      active={isActive("/dashboard/absenteismo")}
                      onClick={() => go("/dashboard/absenteismo")}
                    />
                    <SidebarSubItem
                      label="Faltas"
                      active={isActive("/dashboard/faltas")}
                      onClick={() => go("/dashboard/faltas")}
                    />
                  </>
                )}
                {isGlobal && (
                  <>
                    <SidebarSubItem
                      label="Administrativo"
                      active={isActive("/dashboard/admin")}
                      onClick={() => go("/dashboard/admin")}
                    />
                    <SidebarSubItem
                      label="Internalização"
                      active={isActive("/dashboard/colaboradores")}
                      onClick={() => go("/dashboard/colaboradores")}
                    />
                    <SidebarSubItem
                      label="Desligamentos"
                      active={isActive("/dashboard/desligamento")}
                      onClick={() => go("/dashboard/desligamento")}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ===================== ORGANIZAÇÃO (SÓ ADMIN) ===================== */}
          {isGlobal && (
            <div>
              <button
                onClick={() => setOrganizacaoOpen(!organizacaoOpen)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition ${
                  organizacaoOpen ? "bg-surface-2 text-page" : "text-muted hover:bg-surface-3"
                } ${isCollapsed ? "lg:justify-center" : ""}`}
                title={isCollapsed ? "Organização" : ""}
              >
                <div className="flex items-center gap-3">
                  <Network size={18} />
                  <span className={labelCls}>Organização</span>
                </div>
                <ChevronDown size={16} className={chevronCls(organizacaoOpen)} />
              </button>

              {organizacaoOpen && !isCollapsed && (
                <div className="ml-8 mt-1 space-y-1">
                  <SidebarSubItem label="Empresas" onClick={() => go("/empresas")} />
                  <SidebarSubItem label="Regionais" onClick={() => go("/regionais")} />
                  <SidebarSubItem label="Estações" onClick={() => go("/estacoes")} />
                  <SidebarSubItem label="Setores" onClick={() => go("/setores")} />
                  <SidebarSubItem label="Cargos" onClick={() => go("/cargos")} />
                  <SidebarSubItem label="Turnos" onClick={() => go("/turnos")} />
                  <SidebarSubItem label="Escalas" onClick={() => go("/escalas")} />
                </div>
              )}
            </div>
          )}

          {/* ===================== MENU PRINCIPAL ===================== */}
          {menuItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  active ? "bg-surface-2 text-page" : "text-muted hover:bg-surface-3"
                } ${isCollapsed ? "lg:justify-center" : ""}`}
                title={isCollapsed ? item.label : ""}
              >
                {active && !isCollapsed && (
                  <span className="absolute left-0 h-6 w-1 rounded-r bg-[#FA4C00]" />
                )}
                <item.icon size={18} />
                <span className={`text-sm font-medium ${labelCls}`}>{item.label}</span>
              </button>
            );
          })}

          {/* ===================== MEDIDAS DISCIPLINARES ===================== */}
          {(isGlobal || isLideranca) && (
            <div className="mt-2">
              <button
                onClick={() => setMedidasOpen(!medidasOpen)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition ${
                  location.pathname.startsWith("/medidas-disciplinares")
                    ? "bg-surface-2 text-page"
                    : "text-muted hover:bg-surface-3"
                } ${isCollapsed ? "lg:justify-center" : ""}`}
                title={isCollapsed ? "Medidas Disciplinares" : ""}
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} />
                  <span className={labelCls}>Medidas Disciplinares</span>
                </div>
                <ChevronDown size={16} className={chevronCls(medidasOpen)} />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  medidasOpen && !isCollapsed ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="ml-8 mt-1 space-y-1">
                  <SidebarSubItem
                    label="Listagem"
                    active={isActive("/medidas-disciplinares")}
                    onClick={() => go("/medidas-disciplinares")}
                  />
                  <SidebarSubItem
                    label="Sugestões"
                    active={isActive("/medidas-disciplinares/sugestao")}
                    onClick={() => go("/medidas-disciplinares/sugestao")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ===================== GESTÃO & DESENVOLVIMENTO ===================== */}
          <div className="mt-2">
            <button
              onClick={() => setGestaoOpen(!gestaoOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition ${
                location.pathname.startsWith("/treinamentos")
                  ? "bg-surface-2 text-page"
                  : "text-muted hover:bg-surface-3"
              } ${isCollapsed ? "lg:justify-center" : ""}`}
              title={isCollapsed ? "Gestão & Desenvolvimento" : ""}
            >
              <div className="flex items-center gap-3">
                <Layers size={18} />
                <span className={`${labelCls} whitespace-nowrap`}>Gestão & Desenvolvimento</span>
              </div>
              <ChevronDown size={16} className={chevronCls(gestaoOpen)} />
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                gestaoOpen && !isCollapsed ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="ml-8 mt-1 space-y-1">
                <SidebarSubItem
                  label="Treinamentos"
                  active={isActive("/treinamentos")}
                  onClick={() => go("/treinamentos")}
                />
              </div>
            </div>
          </div>

          {/* ===================== PLANEJAMENTO ===================== */}
          <div className="mt-2">
            <button
              onClick={() => setDwOpen(!dwOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition ${
                location.pathname.startsWith("/dw")
                  ? "bg-surface-2 text-page"
                  : "text-muted hover:bg-surface-3"
              } ${isCollapsed ? "lg:justify-center" : ""}`}
              title={isCollapsed ? "Planejamento e Controle" : ""}
            >
              <div className="flex items-center gap-2">
                <ClipboardList size={16} />
                <span className={labelCls}>Planejamento e Controle</span>
              </div>
              <ChevronDown size={16} className={chevronCls(dwOpen)} />
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                dwOpen && !isCollapsed ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="ml-8 mt-1 space-y-1">
                <SidebarSubItem
                  label="Daily Works"
                  active={isActive("/dw")}
                  onClick={() => go("/dw")}
                />
                <SidebarSubItem
                  label="Planejamento de Folgas"
                  active={isActive("folga-dominical")}
                  onClick={() => go("/folga-dominical")}
                />
              </div>
            </div>
          </div>

          {/* ===================== PONTO ===================== */}
          <div className="mt-2">
            <button
              onClick={() => setPontoOpen(!pontoOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition ${
                location.pathname.startsWith("/ponto")
                  ? "bg-surface-2 text-page"
                  : "text-muted hover:bg-surface-3"
              } ${isCollapsed ? "lg:justify-center" : ""}`}
              title={isCollapsed ? "Ponto" : ""}
            >
              <div className="flex items-center gap-3">
                <Clock size={18} />
                <span className={labelCls}>Ponto</span>
              </div>
              <ChevronDown size={16} className={chevronCls(pontoOpen)} />
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                pontoOpen && !isCollapsed ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="ml-8 mt-1 space-y-1">
                <SidebarSubItem
                  label="Registrar Ponto"
                  active={location.pathname === "/ponto"}
                  onClick={() => go("/ponto")}
                />
                <SidebarSubItem
                  label="Controle de Presença"
                  active={location.pathname === "/ponto/controle"}
                  onClick={() => go("/ponto/controle")}
                />
              </div>
            </div>
          </div>

        </nav>

        {/* Footer com créditos */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out border-t border-default shrink-0 ${
            isCollapsed ? "lg:max-h-0 lg:opacity-0 lg:border-transparent" : "max-h-20 opacity-100"
          }`}
        >
          <div className="px-6 py-4">
            <p className="text-xs text-muted">
              Desenvolvido por:{" "}
              <span className="text-[#FA4C00] font-medium">
                Lucas e Thiago - SOC-PE2
              </span>
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

/* =====================
   SUB ITEM
===================== */
function SidebarSubItem({ label, active, onClick, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        w-full text-left px-4 py-2 rounded-lg text-sm transition
        ${
          disabled
            ? "text-[#6F6F73] cursor-not-allowed"
            : active
            ? "bg-surface-2 text-page"
            : "text-muted hover:bg-surface-3"
        }
      `}
    >
      {label}
    </button>
  );
}
