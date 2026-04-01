import MainLayout from "../../components/MainLayout";
import { Wrench } from "lucide-react";

export default function SugestoesMedidaDisciplinar() {
  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Wrench size={48} className="text-[#FA4C00]" />
        <h1 className="text-2xl font-semibold text-white">Em Manutenção</h1>
        <p className="text-[#BFBFC3] max-w-sm">
          Este módulo está temporariamente indisponível. Voltaremos em breve.
        </p>
      </div>
    </MainLayout>
  );
}
