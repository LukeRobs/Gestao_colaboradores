// src/components/StatCard.jsx
export default function StatCard({ title, value, icon }) {
  // garante um nome com letra maiúscula para usar no JSX
  const Icon = icon;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-all">
      <div className="p-3 bg-blue-600 rounded-xl inline-block mb-4">
        {Icon && <Icon className="w-6 h-6 text-white" />}
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
    </div>
  );
}
