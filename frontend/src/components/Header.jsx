import { useState, useContext } from "react";
import { Menu, Sun, Moon, User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { AuthContext } from "../context/AuthContext";

export default function Header({ onMenuClick }) {
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
