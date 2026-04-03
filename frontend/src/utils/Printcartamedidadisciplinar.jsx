import { renderToStaticMarkup } from "react-dom/server";
import CartaMedidaDisciplinarTemplate from "../components/medidas_disciplinares/CartamedidaDisciplinarTemplate";
import CartaAdeccoTemplate from "../components/medidas_disciplinares/CartaAdeccoTemplate";

// Empresas que usam o template Adecco/Adillis
const EMPRESAS_ADECCO = ["adecco", "adillis", "adilis"];

function detectarTemplate(medida) {
  const nomeEmpresa = (
    medida?.colaborador?.empresa?.razaoSocial || ""
  ).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const isAdecco = EMPRESAS_ADECCO.some((e) => nomeEmpresa.includes(e));

  if (isAdecco) {
    return {
      template: "adecco",
      nomeEmpresa: medida.colaborador.empresa.razaoSocial,
    };
  }

  return { template: "default" };
}

/**
 * Abre uma janela de impressão com a Carta de Medida Disciplinar formatada.
 * O template é selecionado automaticamente com base na empresa do colaborador.
 * @param {Object} medida - Objeto da medida disciplinar (com colaborador.empresa incluído)
 */
export function printCartaMedidaDisciplinar(medida) {
  if (!medida) {
    console.error("Medida disciplinar não fornecida");
    return;
  }

  try {
    // Log para debug — mostra o nome da empresa que está chegando
    const empresaNome = medida?.colaborador?.empresa?.razaoSocial;
    console.log("[printCarta] empresa do colaborador:", empresaNome);

    const { template, nomeEmpresa } = detectarTemplate(medida);

    let htmlString;

    if (template === "adecco") {
      htmlString = renderToStaticMarkup(
        <CartaAdeccoTemplate medida={medida} nomeEmpresa={nomeEmpresa} />
      );
    } else {
      htmlString = renderToStaticMarkup(
        <CartaMedidaDisciplinarTemplate
          medida={medida}
          empresa={medida?.colaborador?.empresa?.razaoSocial || "SPX Express"}
        />
      );
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      alert("Por favor, permita pop-ups para imprimir a carta");
      return;
    }

    printWindow.document.write(htmlString);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };

  } catch (error) {
    console.error("Erro ao gerar carta de medida disciplinar:", error);
    alert("Erro ao gerar carta. Verifique o console para mais detalhes.");
  }
}
