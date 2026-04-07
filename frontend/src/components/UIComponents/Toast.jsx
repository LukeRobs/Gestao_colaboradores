import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";

export const Toast = ({ type = "success", message, onClose }) => {
  const styles = {
    success: { icon: <CheckCircle />, color: "text-success" },
    error: { icon: <XCircle />, color: "text-danger" },
    warning: { icon: <AlertCircle />, color: "text-warning" },
    info: { icon: <Info />, color: "text-info" },
  };

  return (
    <div className="
      fixed top-6 right-6 z-50
      flex items-center gap-3
      px-5 py-3 rounded-xl
      bg-surface/90 backdrop-blur
      shadow-xl animate-slide-in-right
    ">
      <span className={styles[type].color}>
        {styles[type].icon}
      </span>

      <span className="text-sm font-medium text-text">
        {message}
      </span>

      <button
        onClick={onClose}
        className="ml-2 text-muted hover:text-text"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
