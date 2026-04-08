export default function LoadingScreen({ message = "Carregando dados..." }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-page text-muted">
      <div className="relative">
        {/* Círculo animado */}
        <div className="w-16 h-16 border-4 border-default border-t-[#E8491D] rounded-full animate-spin"></div>
      </div>
      <p className="mt-4 text-lg">{message}</p>
    </div>
  );
}