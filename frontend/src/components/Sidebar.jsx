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
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, permissions } = useContext(AuthContext);

  // OPERACAO não vê sidebar
  if (user?.role === "OPERACAO") {
    return null;
  }

  const isAdmin = permissions?.isAdmin;
  const isLideranca = permissions?.isLideranca;

  /* =====================
     SUBMENUS
  ===================== */
  const [dashboardsOpen, setDashboardsOpen] = useState(
    location.pathname.startsWith("/dashboard")
  );

  const [organizacaoOpen, setOrganizacaoOpen] = useState(
    ["/empresas", "/regionais", "/estacoes", "/setores", "/cargos"].some((p) =>
      location.pathname.startsWith(p)
    )
  );
  const [dwOpen, setDwOpen] = useState(location.pathname.startsWith("/dw"));
  const [pontoOpen, setPontoOpen] = useState(
    location.pathname.startsWith("/ponto")
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

    ...(isAdmin || isLideranca
      ? [
          {
            icon: FileText,
            label: "Atestados Médicos",
            path: "/atestados",
          },
          { icon: Settings, label: "Acidentes", path: "/acidentes" },
          {
            icon: FileText,
            label: "Medidas Disciplinares",
            path: "/medidas-disciplinares",
          },
        ]
      : []),

    ...(isAdmin
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
          fixed top-0 left-0 h-full w-64
          bg-[#1A1A1C]
          z-50
          transform transition-transform duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#FA4C00]" />
            <span className="font-semibold text-white tracking-wide">
              Gestão RH
            </span>
          </div>

          <button onClick={onClose} className="lg:hidden text-[#BFBFC3]">
            <X size={18} />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1">
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
                  location.pathname.startsWith("/dashboard")
                    ? "bg-[#2A2A2C] text-white"
                    : "text-[#BFBFC3] hover:bg-[#242426]"
                }
              `}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={18} />
                Dashboards
              </div>
              <ChevronDown
                size={16}
                className={`transition ${dashboardsOpen ? "rotate-180" : ""}`}
              />
            </button>

            {dashboardsOpen && (
              <div className="ml-8 mt-1 space-y-1">
                <SidebarSubItem
                  label="Operacional"
                  active={isActive("/dashboard/operacional")}
                  onClick={() => go("/dashboard/operacional")}
                />

                {isAdmin && (
                  <>
                    <SidebarSubItem
                      label="Administrativo"
                      active={isActive("/dashboard/admin")}
                      onClick={() => go("/dashboard/admin")}
                    />
                    <SidebarSubItem
                      label="Colaboradores"
                      active={isActive("/dashboard/colaboradores")}
                      onClick={() => go("/dashboard/colaboradores")}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          {/* =====================
              ORGANIZAÇÃO (SÓ ADMIN)
          ===================== */}
          {isAdmin && (
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
                `}
              >
                <div className="flex items-center gap-3">
                  <Network size={18} />
                  Organização
                </div>
                <ChevronDown
                  size={16}
                  className={`transition ${
                    organizacaoOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {organizacaoOpen && (
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
                `}
              >
                {active && (
                  <span className="absolute left-0 h-6 w-1 rounded-r bg-[#FA4C00]" />
                )}
                <item.icon size={18} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}

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
              `}
            >
              <div className="flex items-center gap-3">
                <ClipboardList size={18} />
                Planejamento
              </div>
              <ChevronDown
                size={16}
                className={`transition ${dwOpen ? "rotate-180" : ""}`}
              />
            </button>

            {dwOpen && (
              <div className="ml-8 mt-1 space-y-1">
                <SidebarSubItem
                  label="Daily Works"
                  active={isActive("/dw")}
                  onClick={() => go("/dw")}
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
              `}
            >
              <div className="flex items-center gap-3">
                <Clock size={18} />
                Ponto
              </div>
              <ChevronDown
                size={16}
                className={`transition ${pontoOpen ? "rotate-180" : ""}`}
              />
            </button>

            {pontoOpen && (
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

          {/* =====================
              GESTÃO & DESENVOLVIMENTO
          ===================== */}
          <div className="mt-2">
            <div className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#BFBFC3]">
              <Layers size={18} />
              Gestão & Desenvolvimento
            </div>

            <div className="ml-8 mt-1 space-y-1">
              <SidebarSubItem
                label="Treinamentos"
                active={isActive("/treinamentos")}
                onClick={() => go("/treinamentos")}
              />
              <SidebarSubItem label="Recrutamento (em breve)" disabled />
              <SidebarSubItem label="SPI (em breve)" disabled />
            </div>
          </div>
        </nav>
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
