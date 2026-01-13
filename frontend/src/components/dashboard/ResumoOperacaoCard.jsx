import { TrendingUp } from "lucide-react";

export default function ResumoOperacaoCard({
  title,
  data = [],
  labelKey,
}) {
  return (
    <div className="bg-[#1A1A1C] rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <TrendingUp size={18} className="text-[#FA4C00]" />
      </div>

      {data.length === 0 ? (
        <div className="text-sm text-[#BFBFC3]">
          Nenhum dado no período
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-4"
            >
              <div className="text-sm truncate max-w-[60%]">
                {item[labelKey]}
              </div>

              <div className="flex items-center gap-2 min-w-[90px] justify-end">
                <span className="text-sm text-[#BFBFC3]">
                  {item.totalColaboradores || item.total}
                </span>

                <span
                  className={`text-sm font-semibold ${
                    item.absenteismo > 10
                      ? "text-[#FF453A]"
                      : item.absenteismo > 5
                      ? "text-[#FF9F0A]"
                      : "text-[#34C759]"
                  }`}
                >
                  {item.absenteismo}%
                </span>
              </div>
            </div>  
          ))}
        </div>
      )}
    </div>
  );
}
