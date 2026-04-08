import { useState } from "react";
import { Button, Card, Badge, Alert, Toast } from "./index";
import {
  Plus,
  Download,
  Trash2,
  Edit,
  Check,
  User,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";

export default function UIComponentsGuide() {
  const [showToast, setShowToast] = useState(false);
  const [selectedTab, setSelectedTab] = useState("buttons");

  const tabs = ["buttons", "cards", "badges", "alerts", "toast"];

  return (
    <div className="min-h-screen bg-bg p-8 text-text">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          🎨 Guia de Componentes UI
        </h1>
        <p className="text-muted">
          Biblioteca oficial de componentes do sistema
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-surface border border-border rounded-xl p-2 mb-6">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`
                px-6 py-2 rounded-lg font-medium capitalize transition-all
                ${
                  selectedTab === tab
                    ? "bg-brand text-white shadow-lg shadow-brand/30"
                    : "text-muted hover:bg-surfaceHover"
                }
              `}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Buttons */}
      {selectedTab === "buttons" && (
        <div className="bg-surface border border-border rounded-lg p-8 space-y-6">
          <h2 className="text-2xl font-semibold">Botões</h2>

          <div className="flex flex-wrap gap-4">
            <Button.Primary>Primary</Button.Primary>
            <Button.Primary icon={<Plus className="w-5 h-5" />}>
              Com Ícone
            </Button.Primary>
            <Button.Primary disabled>Disabled</Button.Primary>

            <Button.Secondary>Secondary</Button.Secondary>
            <Button.Secondary icon={<Download className="w-5 h-5" />}>
              Download
            </Button.Secondary>

            <Button.Outline>Outline</Button.Outline>

            <Button.IconButton icon={<Edit />} />
            <Button.IconButton icon={<Trash2 />} variant="danger" />
            <Button.IconButton icon={<Check />} variant="success" />
          </div>
        </div>
      )}

      {/* Cards */}
      {selectedTab === "cards" && (
        <div className="bg-surface border border-border rounded-lg p-8">
          <h2 className="text-2xl font-semibold mb-6">Cards</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card.Simple
              title="Card Simples"
              description="Este é um card básico."
            />

            <Card.WithIcon
              title="Card com Ícone"
              description="Card com destaque visual."
              icon={<User className="w-6 h-6" />}
            />

            <Card.Stat
              label="Total de Usuários"
              value="1.234"
              delta="+12% vs mês anterior"
            />
          </div>
        </div>
      )}

      {/* Badges */}
      {selectedTab === "badges" && (
        <div className="bg-surface border border-border rounded-lg p-8 space-y-4">
          <h2 className="text-2xl font-semibold">Badges</h2>

          <div className="flex flex-wrap gap-3">
            <Badge.Status>Default</Badge.Status>
            <Badge.Status variant="success">Ativo</Badge.Status>
            <Badge.Status variant="danger">Inativo</Badge.Status>
            <Badge.Status variant="warning">Pendente</Badge.Status>
            <Badge.Status variant="info">Em Processo</Badge.Status>
          </div>

          <div className="flex flex-wrap gap-3">
            <Badge.WithIcon
              icon={<CheckCircle className="w-4 h-4" />}
              variant="success"
            >
              Aprovado
            </Badge.WithIcon>

            <Badge.WithIcon
              icon={<XCircle className="w-4 h-4" />}
              variant="danger"
            >
              Rejeitado
            </Badge.WithIcon>

            <Badge.WithIcon
              icon={<Clock className="w-4 h-4" />}
              variant="warning"
            >
              Aguardando
            </Badge.WithIcon>
          </div>
        </div>
      )}

      {/* Alerts */}
      {selectedTab === "alerts" && (
        <div className="bg-surface border border-border rounded-lg p-8 space-y-4">
          <h2 className="text-2xl font-semibold">Alerts</h2>

          <Alert
            type="success"
            title="Sucesso"
            message="Operação realizada com sucesso."
          />
          <Alert
            type="error"
            title="Erro"
            message="Ocorreu um erro inesperado."
          />
          <Alert
            type="warning"
            title="Atenção"
            message="Verifique os dados antes de continuar."
          />
          <Alert
            type="info"
            title="Informação"
            message="Esta é uma mensagem informativa."
          />
        </div>
      )}

      {/* Toast */}
      {selectedTab === "toast" && (
        <div className="bg-surface border border-border rounded-lg p-8">
          <h2 className="text-2xl font-semibold mb-6">
            Toast Notifications
          </h2>

          <Button.Primary
            onClick={() => {
              setShowToast(true);
              setTimeout(() => setShowToast(false), 3000);
            }}
          >
            Mostrar Toast
          </Button.Primary>
        </div>
      )}

      {showToast && (
        <Toast
          type="success"
          message="Operação realizada com sucesso!"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}
