import { User } from "lucide-react";

export const Card = {
  Simple: ({ title, description }) => (
    <div
      className="
        bg-linear-to-b from-surface to-surfaceHover
        rounded-xl p-6
      "
    >
      <h3 className="text-base font-semibold text-text mb-1">
        {title}
      </h3>
      <p className="text-sm text-muted">{description}</p>
    </div>
  ),

  WithIcon: ({ title, description, icon }) => (
    <div
      className="
        bg-linear-to-b from-surface to-surfaceHover
        rounded-xl p-6
      "
    >
      <div
        className="
          w-10 h-10 mb-4
          rounded-lg bg-brand/15 text-brand
          flex items-center justify-center
        "
      >
        {icon || <User className="w-5 h-5" />}
      </div>

      <h3 className="text-base font-semibold text-text mb-1">
        {title}
      </h3>
      <p className="text-sm text-muted">{description}</p>
    </div>
  ),

  Stat: ({ label, value, delta }) => (
    <div
      className="
        bg-linear-to-b from-surface to-surfaceHover
        rounded-xl p-6
      "
    >
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-3xl font-bold text-text">{value}</p>
      {delta && <p className="text-xs text-success mt-1">{delta}</p>}
    </div>
  ),
};
