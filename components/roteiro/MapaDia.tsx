"use client";

/**
 * Mapa do dia — marcadores numerados na ordem da rota, ligados por uma linha.
 *
 * Carregado só no cliente (o Leaflet mexe em `window` no topo do módulo), via
 * o wrapper em MapaDiaDinamico.tsx.
 *
 * `crossOrigin` no TileLayer não é detalhe: sem ele o navegador busca os tiles
 * sem CORS e o service worker só consegue guardar respostas opacas, que o
 * Chrome infla para ~7 MB cada na contagem de cota. Com ele, o cache do mapa
 * cabe no aparelho.
 */

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { centroDe, distanciaDaRota } from "@/lib/geo";
import { COR_TIPO_CLIENTE, type Cliente, type ParadaRoteiro } from "@/lib/types";

export interface PontoParada {
  parada: ParadaRoteiro;
  cliente: Cliente & { lat: number; lng: number };
}

function icone(numero: number, cor: string, concluida: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:30px;height:30px;border-radius:50%;
      background:${concluida ? "#8a93a5" : cor};
      border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);
      color:#fff;font:700 14px/24px system-ui,sans-serif;text-align:center;
      ${concluida ? "opacity:.75" : ""}
    ">${concluida ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 12.8l4.6 4.6L19.2 7.4"/></svg>' : numero}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

/** Enquadra o mapa nas paradas do dia sempre que elas mudam. */
function Enquadrar({ pontos }: { pontos: PontoParada[] }) {
  const mapa = useMap();
  useEffect(() => {
    if (pontos.length === 0) return;
    if (pontos.length === 1) {
      mapa.setView([pontos[0].cliente.lat, pontos[0].cliente.lng], 15);
      return;
    }
    mapa.fitBounds(
      L.latLngBounds(pontos.map((p) => [p.cliente.lat, p.cliente.lng] as [number, number])),
      { padding: [40, 40], maxZoom: 16 },
    );
  }, [mapa, pontos]);
  return null;
}

export default function MapaDia({ pontos }: { pontos: PontoParada[] }) {
  const centro = useMemo(
    () => centroDe(pontos.map((p) => ({ lat: p.cliente.lat, lng: p.cliente.lng }))),
    [pontos],
  );
  const linha = useMemo(
    () => pontos.map((p) => [p.cliente.lat, p.cliente.lng] as [number, number]),
    [pontos],
  );
  const km = useMemo(
    () => distanciaDaRota(pontos.map((p) => ({ lat: p.cliente.lat, lng: p.cliente.lng }))),
    [pontos],
  );

  return (
    <div className="relative">
      <MapContainer
        center={[centro.lat, centro.lng]}
        zoom={14}
        scrollWheelZoom={false}
        className="h-64 w-full rounded-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          crossOrigin="anonymous"
          maxZoom={19}
        />
        <Polyline positions={linha} pathOptions={{ color: "#0b3fa8", weight: 3, opacity: 0.7 }} />
        {pontos.map((p) => (
          <Marker
            key={p.parada.clienteId}
            position={[p.cliente.lat, p.cliente.lng]}
            icon={icone(p.parada.ordem, COR_TIPO_CLIENTE[p.cliente.tipo], p.parada.concluida)}
          >
            <Popup>
              <strong>
                {p.parada.ordem}. {p.cliente.nome}
              </strong>
              <br />
              {p.parada.horarioSugerido && `${p.parada.horarioSugerido} · `}
              {p.cliente.bairro || p.cliente.cidade}
              {p.parada.objetivo && (
                <>
                  <br />
                  {p.parada.objetivo}
                </>
              )}
            </Popup>
          </Marker>
        ))}
        <Enquadrar pontos={pontos} />
      </MapContainer>
      {km > 0 && (
        <p className="pointer-events-none absolute bottom-2 left-2 z-[400] rounded-md bg-carta/90 px-2 py-1 text-xs font-bold shadow">
          ~{km.toFixed(1)} km em linha reta
        </p>
      )}
    </div>
  );
}
