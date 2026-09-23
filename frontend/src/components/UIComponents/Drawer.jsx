import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

/**
 * Painel lateral (Drawer) deslizando da direita — usado quando o conteúdo
 * é secundário/contextual e não deve interromper o fluxo com um Modal central.
 */
export function Drawer({ open, onOpenChange, title, icon, children, footer }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <style>{`
          @keyframes drawerFadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes drawerSlideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
        `}</style>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          style={{ animation: "drawerFadeIn 0.2s ease-out" }}
        />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 h-screen w-full sm:max-w-md bg-surface border-l border-default shadow-2xl flex flex-col"
          style={{ animation: "drawerSlideIn 0.25s ease-out" }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-default shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {icon}
              <Dialog.Title className="font-semibold text-base truncate">{title}</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="text-muted hover:text-page transition-colors shrink-0">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer && (
            <div className="px-5 py-4 border-t border-default shrink-0 flex flex-wrap justify-end gap-3">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
