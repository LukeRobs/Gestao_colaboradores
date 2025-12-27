import {
  LayoutDashboard,
  Users,
  Clock,
  Building2,
  Briefcase,
  Layers,
  FileText,
  Settings,
  X
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate(); // ✅ AQUI É O FIX

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Users, label: "Colaboradores", path: "/colaboradores" },
    { icon: Clock, label: "Ponto", path: "/ponto" },
    { icon: Building2, label: "Empresas", path: "/empresas" },
    { icon: Layers, label: "Setores", path: "/setores" },
    { icon: Briefcase, label: "Cargos", path: "/cargos" },
    { icon: FileText, label: "Atestados Médicos", path: "/atestados" },
    { icon: Settings, label: "Acidentes", path: "/acidentes" },
    { icon: FileText, label: "Medidas Disciplinares", path: "/medidas-disciplinares" }
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

        {/* Menu */}
        <nav className="px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            const isDashboard = item.path === "/";
            const active = isDashboard
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);


            return (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  navigate(item.path); // ✅ SEMPRE FUNCIONA
                  onClose?.();
                }}
                className={`
                  relative group w-full flex items-center gap-3
                  px-4 py-3 rounded-xl
                  transition
                  ${
                    active
                      ? "bg-[#2A2A2C] text-white"
                      : "text-[#BFBFC3] hover:bg-[#242426]"
                  }
                `}
              >
                {/* Barra ativa */}
                {active && (
                  <span className="absolute left-0 h-6 w-1 rounded-r bg-[#FA4C00]" />
                )}

                <item.icon
                  size={18}
                  className={active ? "text-[#FA4C00]" : "text-[#BFBFC3]"}
                />

                <span className="text-sm font-medium">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
