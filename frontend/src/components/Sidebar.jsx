import { LayoutDashboard, Users, Clock, Building2, Briefcase, Layers, FileText, Settings, X } from "lucide-react";

export default function Sidebar({ isOpen, onClose, navigate }) {
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Colaboradores', path: '/colaboradores' },
    { icon: Clock, label: 'Ponto', path: '/ponto' },
    { icon: Building2, label: 'Empresas', path: '/empresas' },
    { icon: Layers, label: 'Setores', path: '/setores' },
    { icon: Briefcase, label: 'Cargos', path: '/cargos' },
    { icon: FileText, label: 'Relatórios', path: '/relatorios' },
    { icon: Settings, label: 'Configurações', path: '/configuracoes' },
  ];

  return (
    <>
      {/* OVERLAY — fica por cima de tudo no mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-index[999]"
          onClick={onClose}
        />
      )}

      {/* SIDEBAR COM PRIORIDADE MÁXIMA */}
      <aside
        className={`
          fixed top-0 left-0 h-screen 
          bg-white dark:bg-gray-900 
          border-r border-gray-200 dark:border-gray-800 
          w-64 
          transition-transform duration-300
          z-index[1000]
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* HEADER DO SIDEBAR */}
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

        {/* MENU */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                navigate(item.path);
                onClose?.(); // fecha no mobile
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left
                         text-gray-700 dark:text-gray-300 
                         hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
