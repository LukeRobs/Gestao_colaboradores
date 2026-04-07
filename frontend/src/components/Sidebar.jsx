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
  const [pontoOpen, setPontoOpen] = useState(
    location.pathname.startsWith("/ponto")
  );

  const [medidasOpen, setMedidasOpen] = useState(
  location.pathname.startsWith("/medidas-disciplinares")
);

  const [gestaoOpen, setGestaoOpen] = useState(
    location.pathname.startsWith("/treinamentos")
  );

  const isActive = (path) =>
    location.pathname === path ||
    location.pathname.startsWith(path + "/");

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
          {
            icon: FileText,
            label: "Atestados Médicos",
            path: "/atestados",
          },
          { icon: Settings, label: "Acidentes", path: "/acidentes" },
        ]
      : []),

    ...(isGlobal
      ? [
          {
            icon: Upload,
            label: "Importar colaboradores",
            path: "/colaboradores/import",
          },
        ]
      : []),
  ];

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
          fixed top-0 left-0 h-full
          bg-[#1A1A1C]
          z-50
          transform transition-all duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${isCollapsed ? "lg:w-20" : "lg:w-64"}
          w-64
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#FA4C00]" />
            {!isCollapsed && (
              <div className="flex flex-col leading-tight">
                <span className="font-semibold text-white tracking-wide">
                  COPEOPLE
                </span>
                {nomeEstacao && (
                  <span className="text-[10px] text-[#FA4C00] truncate max-w-[130px]">
                    {nomeEstacao}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Button (Desktop only) */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:block p-2 rounded-lg text-[#BFBFC3] hover:bg-[#242426] transition"
              title={isCollapsed ? "Expandir" : "Recolher"}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>

            {/* Close button (Mobile only) */}
            <button onClick={onClose} className="lg:hidden text-[#BFBFC3]">
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="px-3 py-4 space-y-1 flex-1 overflow-y-auto scrollbar-hide">
          {/* =====================
              DASHBOARDS
          ===================== */}
          <div>
            <button
              onClick={() => setDashboardsOpen(!dashboardsOpen)}
              className={`
                w-full flex items-center justify-between
                px-4 py-3 rounded-xl text-sm font-medium transition
                ${
                  location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/spi")
                    ? "bg-[#2A2A2C] text-white"
                    : "text-[#BFBFC3] hover:bg-[#242426]"
                }
                ${isCollapsed ? "lg:justify-center" : ""}
              `}
              title={isCollapsed ? "Dashboards" : ""}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={18} />
                {!isCollapsed && <span>Dashboards</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={16}
                  className={`transition ${dashboardsOpen ? "rotate-180" : ""}`}
                />
              )}
            </button>

            {dashboardsOpen && !isCollapsed && (
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
            )}
          </div>

          {/* =====================
              ORGANIZAÇÃO (SÓ ADMIN)
          ===================== */}
          {isGlobal && (
            <div>
              <button
                onClick={() => setOrganizacaoOpen(!organizacaoOpen)}
                className={`
                  w-full flex items-center justify-between
                  px-4 py-3 rounded-xl text-sm font-medium transition
                  ${
                    organizacaoOpen
                      ? "bg-[#2A2A2C] text-white"
                      : "text-[#BFBFC3] hover:bg-[#242426]"
                  }
                  ${isCollapsed ? "lg:justify-center" : ""}
                `}
                title={isCollapsed ? "Organização" : ""}
              >
                <div className="flex items-center gap-3">
                  <Network size={18} />
                  {!isCollapsed && <span>Organização</span>}
                </div>
                {!isCollapsed && (
                  <ChevronDown
                    size={16}
                    className={`transition ${
                      organizacaoOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              {organizacaoOpen && !isCollapsed && (
                <div className="ml-8 mt-1 space-y-1">
                  <SidebarSubItem label="Empresas" onClick={() => go("/empresas")} />
                  <SidebarSubItem
                    label="Regionais"
                    onClick={() => go("/regionais")}
                  />
                  <SidebarSubItem
                    label="Estações"
                    onClick={() => go("/estacoes")}
                  />
                  <SidebarSubItem label="Setores" onClick={() => go("/setores")} />
                  <SidebarSubItem label="Cargos" onClick={() => go("/cargos")} />
                  <SidebarSubItem label="Turnos" onClick={() => go("/turnos")} />
                  <SidebarSubItem label="Escalas" onClick={() => go("/escalas")} />
                </div>
              )}
            </div>
          )}

          {/* =====================
              MENU PRINCIPAL
          ===================== */}
          {menuItems.map((item) => {
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                className={`
                  relative w-full flex items-center gap-3
                  px-4 py-3 rounded-xl transition
                  ${
                    active
                      ? "bg-[#2A2A2C] text-white"
                      : "text-[#BFBFC3] hover:bg-[#242426]"
                  }
                  ${isCollapsed ? "lg:justify-center" : ""}
                `}
                title={isCollapsed ? item.label : ""}
              >
                {active && !isCollapsed && (
                  <span className="absolute left-0 h-6 w-1 rounded-r bg-[#FA4C00]" />
                )}
                <item.icon size={18} />
                {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            );
          })}
          {/* =====================
              MEDIDAS DISCIPLINARES
          ===================== */}
          {(isGlobal || isLideranca) && (
            <div className="mt-2">
              <button
                onClick={() => setMedidasOpen(!medidasOpen)}
                className={`
                  w-full flex items-center justify-between
                  px-4 py-3 rounded-xl text-sm font-medium transition
                  ${
                    location.pathname.startsWith("/medidas-disciplinares")
                      ? "bg-[#2A2A2C] text-white"
                      : "text-[#BFBFC3] hover:bg-[#242426]"
                  }
                  ${isCollapsed ? "lg:justify-center" : ""}
                `}
                title={isCollapsed ? "Medidas Disciplinares" : ""}
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} />
                  {!isCollapsed && <span>Medidas Disciplinares</span>}
                </div>

                {!isCollapsed && (
                  <ChevronDown
                    size={16}
                    className={`transition ${medidasOpen ? "rotate-180" : ""}`}
                  />
                )}
              </button>

              {medidasOpen && !isCollapsed && (
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
              )}
            </div>
          )}
          {/* =====================
              GESTÃO & DESENVOLVIMENTO
          ===================== */}
          <div className="mt-2">
            <button
              onClick={() => setGestaoOpen(!gestaoOpen)}
              className={`
                w-full flex items-center justify-between
                px-4 py-3 rounded-xl text-sm font-medium transition
                ${
                  location.pathname.startsWith("/treinamentos")
                    ? "bg-[#2A2A2C] text-white"
                    : "text-[#BFBFC3] hover:bg-[#242426]"
                }
                ${isCollapsed ? "lg:justify-center" : ""}
              `}
              title={isCollapsed ? "Gestão & Desenvolvimento" : ""}
            >
              <div className="flex items-center gap-3">
                <Layers size={18} />
                {!isCollapsed && <span className="whitespace-nowrap">Gestão & Desenvolvimento</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={16}
                  className={`transition ${gestaoOpen ? "rotate-180" : ""}`}
                />
              )}
            </button>

            {gestaoOpen && !isCollapsed && (
              <div className="ml-8 mt-1 space-y-1">
                <SidebarSubItem
                  label="Treinamentos"
                  active={isActive("/treinamentos")}
                  onClick={() => go("/treinamentos")}
                />
              </div>
            )}
          </div>

          {/* =====================
              PLANEJAMENTO
          ===================== */}
          <div className="mt-2">
            <button
              onClick={() => setDwOpen(!dwOpen)}
              className={`
                w-full flex items-center justify-between
                px-4 py-3 rounded-xl text-sm font-medium transition
                ${
                  location.pathname.startsWith("/dw")
                    ? "bg-[#2A2A2C] text-white"
                    : "text-[#BFBFC3] hover:bg-[#242426]"
                }
                ${isCollapsed ? "lg:justify-center" : ""}
              `}
              title={isCollapsed ? "Planejamento e Controle" : ""}
            >
              <div className="flex items-center gap-2">
                <ClipboardList size={16} />
                {!isCollapsed && <span>Planejamento e Controle</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={16}
                  className={`transition ${dwOpen ? "rotate-180" : ""}`}
                />
              )}
            </button>

            {dwOpen && !isCollapsed && (
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
            )}
          </div>

          {/* =====================
              PONTO
          ===================== */}
          <div className="mt-2">
            <button
              onClick={() => setPontoOpen(!pontoOpen)}
              className={`
                w-full flex items-center justify-between
                px-4 py-3 rounded-xl text-sm font-medium transition
                ${
                  location.pathname.startsWith("/ponto")
                    ? "bg-[#2A2A2C] text-white"
                    : "text-[#BFBFC3] hover:bg-[#242426]"
                }
                ${isCollapsed ? "lg:justify-center" : ""}
              `}
              title={isCollapsed ? "Ponto" : ""}
            >
              <div className="flex items-center gap-3">
                <Clock size={18} />
                {!isCollapsed && <span>Ponto</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={16}
                  className={`transition ${pontoOpen ? "rotate-180" : ""}`}
                />
              )}
            </button>

            {pontoOpen && !isCollapsed && (
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
            )}
          </div>

        </nav>
         {/* Footer com créditos */}
        {!isCollapsed && (
          <div className="px-6 py-4 border-t border-white/5 shrink-0">
            <p className="text-xs text-[#BFBFC3]">
              Desenvolvido por:{" "}
              <span className="text-[#FA4C00] font-medium">
                Lucas e Thiago - SOC-PE2
              </span>
            </p>
          </div>
        )}
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
            ? "bg-[#242426] text-white"
            : "text-[#BFBFC3] hover:bg-[#242426]"
        }
      `}
    >
      {label}
    </button>
  );
}
