import { useEffect, useRef } from "react";
import { carregarLeaflet, criarMapa, ESTADOS_MAPA, estadoDoVeiculo, iconeEstacao, iconeVeiculo, seguirTema } from "./mapaLeaflet";

/** Mapa pequeno de uma viagem: trilha das leituras de telemetria, posição atual e a estação de destino. */
export default function MiniMapaViagem({ viagem }) {
  const ref = useRef(null);

  useEffect(() => {
    let cancelado = false;
    let mapa = null;
    let parar = () => {};

    carregarLeaflet().then((L) => {
      if (cancelado || !ref.current) return;
      const leituras = viagem.telemetria || [];
      const atual = leituras[0];
      if (!atual) return;

      mapa = criarMapa(L, ref.current, { zoomInicial: 6, centro: [atual.lat, atual.lng] });
      parar = seguirTema(L, mapa);

      const estado = ESTADOS_MAPA[estadoDoVeiculo({ ...viagem, ultimaLeitura: atual })];
      const trilha = [...leituras].reverse().map((o) => [o.lat, o.lng]); // da mais antiga para a atual
      const limites = [[atual.lat, atual.lng]];

      if (trilha.length > 1) {
        L.polyline(trilha, { color: estado.cor, weight: 4, opacity: 0.85, lineCap: "round" }).addTo(mapa);
        L.circleMarker(trilha[0], { radius: 5, color: "#fff", weight: 2, fillColor: estado.cor, fillOpacity: 1 }).addTo(mapa).bindTooltip("Primeira leitura", { direction: "top" });
      }

      L.marker([atual.lat, atual.lng], { icon: iconeVeiculo(L, { cor: estado.cor, pulsa: (atual.velocidadeKmh || 0) > 0, selecionado: true }), zIndexOffset: 1000 })
        .addTo(mapa)
        .bindTooltip(`${atual.local || "Posição atual"} · ${atual.velocidadeKmh || 0} km/h`, { direction: "top", offset: [0, -14] });

      const dest = viagem.destino?.coords;
      if (dest) {
        L.marker(dest, { icon: iconeEstacao(L, viagem.destino.codigo) }).addTo(mapa);
        L.polyline([[atual.lat, atual.lng], dest], { color: "#FA4C00", weight: 2, opacity: 0.7, dashArray: "6 8" }).addTo(mapa);
        limites.push(dest);
      }
      trilha.forEach((p) => limites.push(p));
      mapa.fitBounds(L.latLngBounds(limites), { padding: [40, 40], maxZoom: 11 });
    });

    return () => {
      cancelado = true;
      parar();
      if (mapa) mapa.remove();
    };
  }, [viagem]);

  return <div ref={ref} className="h-72 w-full rounded-xl overflow-hidden border border-default" role="img" aria-label="Mapa com a trilha e a posição atual do veículo" />;
}
