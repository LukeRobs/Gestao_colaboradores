import { useSidebar } from "../context/SidebarContext";

export default function MainLayout({ children, className = "", style = {}, disabled = false }) {
  const { isCollapsed } = useSidebar();

  return (
    <div
      className={`
        flex-1 
        transition-all 
        duration-300
        ${!disabled ? (isCollapsed ? "lg:ml-20" : "lg:ml-64") : ""}
        ${className}
      `}
      style={{ minWidth: 0, ...style }}
    >
      {children}
    </div>
  );
}
