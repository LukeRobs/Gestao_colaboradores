import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";

export const Alert = ({ type = "info", title, message }) => {
  const styles = {
    success: {
      icon: <CheckCircle className="w-5 h-5 text-success" />,
      accent: "border-success/40",
    },
    error: {
      icon: <XCircle className="w-5 h-5 text-danger" />,
      accent: "border-danger/40",
    },
    warning: {
      icon: <AlertCircle className="w-5 h-5 text-warning" />,
      accent: "border-warning/40",
    },
    info: {
      icon: <Info className="w-5 h-5 text-info" />,
      accent: "border-info/40",
    },
  };

  const current = styles[type];

  return (
    <div
      className={`
        flex gap-4 px-5 py-4
        bg-surface/80 backdrop-blur
        rounded-xl border-l-4 ${current.accent}
      `}
    >
      {current.icon}

      <div>
        <p className="font-semibold text-text">{title}</p>
        <p className="text-sm text-muted mt-1">{message}</p>
      </div>
    </div>
  );
};
