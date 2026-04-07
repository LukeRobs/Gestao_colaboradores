import { useSidebar } from "../context/SidebarContext";

export default function MainLayout({ children, className = "" }) {
  const { isCollapsed } = useSidebar();

  return (
    <div
      className={`
        flex-1 
        transition-all 
        duration-300
        ${isCollapsed ? "lg:ml-20" : "lg:ml-64"}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
