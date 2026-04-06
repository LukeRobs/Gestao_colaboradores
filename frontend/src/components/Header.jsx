import { Menu, Sun, Moon, User, LogOut } from "lucide-react";
import { useContext, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { ThemeContext } from "../context/ThemeContext";
import EstacaoSelector from "./EstacaoSelector";

export default function Header({ onMenuClick }) {
  const { user, logout } = useContext(AuthContext);
  const { isDark, setIsDark } = useContext(ThemeContext);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  /* ================= FECHAR AO CLICAR FORA ================= */
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    function handleEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <header
      className="
        h-16
        px-4 sm:px-6
        flex items-center justify-between
        bg-[#0D0D0D]/90
        backdrop-blur-md
        border-b border-[#1F1F22]
        sticky top-0 z-40
      "
    >
      {/* ================= ESQUERDA ================= */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-[#1A1A1C] transition"
        >
          <Menu size={20} className="text-[#BFBFC3]" />
        </button>

        <span className="hidden sm:block text-sm text-[#BFBFC3] truncate">
          Dashboard
        </span>
      </div>

      {/* ================= DIREITA ================= */}
      <div className="flex items-center gap-2 sm:gap-3">

        {/* SELETOR DE ESTAÇÃO (só para ADMIN) */}
        <EstacaoSelector />

        {/* TOGGLE TEMA */}
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-lg hover:bg-[#1A1A1C] transition"
          title="Alternar tema"
        >
          {isDark ? (
            <Sun size={18} className="text-[#FFD60A]" />
          ) : (
            <Moon size={18} className="text-[#BFBFC3]" />
          )}
        </button>

        {/* ================= USUÁRIO ================= */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen(!open)}
            className="
              flex items-center gap-3
              p-2 rounded-lg
              hover:bg-[#1A1A1C]
              transition
              max-w-[180px]
            "
          >
            <div className="w-8 h-8 rounded-full bg-[#FA4C00] flex items-center justify-center shrink-0">
              <User size={16} className="text-white" />
            </div>

            {/* Nome escondido em mobile */}
            <div className="hidden md:flex flex-col items-start leading-tight truncate">
              <span className="text-sm text-white font-medium truncate max-w-[120px]">
                {user?.nome}
              </span>

              <span className="text-xs text-[#BFBFC3] truncate max-w-[120px]">
                {user?.papel || "Usuário"}
              </span>
            </div>
          </button>

          {/* ================= DROPDOWN ================= */}
          <div
            className={`
              absolute right-0 mt-3 w-52
              bg-[#1A1A1C]
              border border-[#2C2C2F]
              rounded-xl
              shadow-2xl
              py-2
              z-50
              origin-top-right
              transition-all duration-150
              ${
                open
                  ? "opacity-100 scale-100 translate-y-0"
                  : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
              }
            `}
          >
            {/* Info usuário */}
            <div className="px-4 py-3 border-b border-[#2C2C2F]">
              <p className="text-sm font-medium text-white truncate">
                {user?.nome}
              </p>
              <p className="text-xs text-[#BFBFC3] truncate">
                {user?.email || ""}
              </p>
            </div>

            {/* Logout */}
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="
                w-full px-4 py-2
                flex items-center gap-3
                text-sm text-[#FF453A]
                hover:bg-[#2A2A2C]
                transition
              "
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}