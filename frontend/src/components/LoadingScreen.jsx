export default function LoadingScreen({ message = "Carregando dados..." }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0D0D0D] text-[#BFBFC3]">
      <div className="relative">
        {/* Círculo animado */}
        <div className="w-16 h-16 border-4 border-[#2A2A2C] border-t-[#E8491D] rounded-full animate-spin"></div>
      </div>
      <p className="mt-4 text-lg">{message}</p>
    </div>
  );
}