export const Button = {
  Primary: ({ children, icon, disabled, ...props }) => (
    <button
      {...props}
      disabled={disabled}
      className={`
        inline-flex items-center gap-2
        px-5 py-2.5 rounded-lg text-sm font-semibold
        transition
        ${
          disabled
            ? "bg-brand/40 cursor-not-allowed text-white/70"
            : "bg-brand hover:bg-brandHover shadow hover:shadow-brand/30"
        }
        text-white
      `}
    >
      {icon}
      {children}
    </button>
  ),

  Secondary: ({ children, icon, ...props }) => (
    <button
      {...props}
      className="
        inline-flex items-center gap-2
        px-5 py-2.5 rounded-lg text-sm font-medium
        bg-surfaceHover hover:bg-surface-3
        text-text transition
      "
    >
      {icon}
      {children}
    </button>
  ),

  Outline: ({ children, ...props }) => (
    <button
      {...props}
      className="
        px-5 py-2.5 rounded-lg text-sm font-medium
        border border-brand/40 text-brand
        hover:bg-brand/10 transition
      "
    >
      {children}
    </button>
  ),

  IconButton: ({ children, variant = "default", ...props }) => {
    const variants = {
      default: "bg-surfaceHover hover:bg-surface-3 text-text",
      danger: "bg-danger/10 hover:bg-danger/20 text-danger",
      success: "bg-success/10 hover:bg-success/20 text-success",
    };

    return (
      <button
        {...props}
        className={`
          p-2 rounded-lg transition
          ${variants[variant]}
        `}
      >
        {children}
      </button>
    );
  },
};
