export const Badge = {
  Status: ({ children, variant = "default" }) => {
    const variants = {
      default: "bg-surfaceHover text-muted",
      success: "bg-success/15 text-success",
      danger: "bg-danger/15 text-danger",
      warning: "bg-warning/15 text-warning",
      info: "bg-info/15 text-info",
    };

    return (
      <span
        className={`
          inline-flex items-center
          px-2.5 py-0.5
          rounded-md text-xs font-semibold
          ${variants[variant]}
        `}
      >
        {children}
      </span>
    );
  },

  WithIcon: ({ children, icon, variant = "default" }) => (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-2.5 py-0.5
        rounded-md text-xs font-semibold
        ${
          {
            default: "bg-surfaceHover text-muted",
            success: "bg-success/15 text-success",
            danger: "bg-danger/15 text-danger",
            warning: "bg-warning/15 text-warning",
            info: "bg-info/15 text-info",
          }[variant]
        }
      `}
    >
      {icon}
      {children}
    </span>
  ),
};
