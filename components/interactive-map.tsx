"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Layers,
  MapPin,
  Ruler,
  Maximize2,
  Minimize2,
  Trash2,
  Undo2,
  Crosshair,
  Compass,
  Download,
  Copy,
  Check,
  Globe,
  Navigation,
} from "lucide-react";
import type { GeoPoint } from "@/lib/legacy-geometry";
import {
  calculatePolygonProperties,
  calculateVincentyDistanceAndAzimuth,
} from "@/lib/geodesy-advanced";

export type MapMode = "polygon" | "distance" | "pinpoint";
export type BaseLayerType = "satellite" | "osm" | "dark";

interface InteractiveMapProps {
  initialPoints?: GeoPoint[];
  onPointsChange?: (points: GeoPoint[]) => void;
  height?: string;
  language?: "uz" | "ru" | "en";
  activeModule?: string;
}

export default function InteractiveMap({
  initialPoints = [],
  onPointsChange,
  height = "520px",
  language = "uz",
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polygonLayerRef = useRef<any>(null);
  const polylineLayerRef = useRef<any>(null);
  const activePinMarkerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const labelsLayerRef = useRef<any>(null);

  const [points, setPoints] = useState<GeoPoint[]>(initialPoints);
  const [mapMode, setMapMode] = useState<MapMode>("polygon");
  const [baseLayer, setBaseLayer] = useState<BaseLayerType>("satellite");
  const [mouseCoord, setMouseCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [pinnedCoord, setPinnedCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const t = {
    polygon: language === "ru" ? "Площадь (Полигон)" : language === "en" ? "Area (Polygon)" : "Yuza (Poligon)",
    distance: language === "ru" ? "Расстояние (Линия)" : language === "en" ? "Distance (Line)" : "Masofa (Chiziq)",
    pinpoint: language === "ru" ? "Координата (Точка)" : language === "en" ? "Pinpoint (Point)" : "Koordinata (Nuqta)",
    satellite: language === "ru" ? "Спутник" : language === "en" ? "Satellite" : "Sun'iy yo‘ldosh",
    osm: language === "ru" ? "Схема" : language === "en" ? "Street Map" : "Xarita (OSM)",
    dark: language === "ru" ? "Тёмная" : language === "en" ? "Dark Mode" : "Tungi xarita",
    clear: language === "ru" ? "Очистить" : language === "en" ? "Clear" : "Tozalash",
    undo: language === "ru" ? "Отмена точки" : language === "en" ? "Undo Point" : "Nuqtani qaytarish",
    locateMe: language === "ru" ? "Моё местоположение" : language === "en" ? "Locate Me" : "Mening joylashuvim",
    fitBounds: language === "ru" ? "По границам" : language === "en" ? "Fit Bounds" : "Maydonga yaqinlashish",
    area: language === "ru" ? "Площадь:" : language === "en" ? "Area:" : "Maydon:",
    perimeter: language === "ru" ? "Периметр:" : language === "en" ? "Perimeter:" : "Perimetr:",
    totalDistance: language === "ru" ? "Общая длина:" : language === "en" ? "Total distance:" : "Umumiy masofa:",
    pointsCount: language === "ru" ? "точек" : language === "en" ? "points" : "ta nuqta",
    clickToAdd: language === "ru" ? "Кликните на карту для добавления точек" : language === "en" ? "Click on the map to add points" : "Nuqta qo‘shish uchun xaritani bosing",
    copy: language === "ru" ? "Копировать" : language === "en" ? "Copy" : "Nusxalash",
    copied: language === "ru" ? "Скопировано!" : language === "en" ? "Copied!" : "Nusxalandi!",
    exportGeoJSON: language === "ru" ? "Экспорт GeoJSON" : language === "en" ? "Export GeoJSON" : "GeoJSON yuklab olish",
    sotix: language === "ru" ? "соток" : language === "en" ? "sotix" : "sotix",
    ha: language === "ru" ? "га" : language === "en" ? "ha" : "ga",
  };

  // Sync with initialPoints when changed from outside
  useEffect(() => {
    if (initialPoints && initialPoints.length > 0) {
      setPoints(initialPoints);
    }
  }, [initialPoints]);

  // Notify parent on points change
  const updatePoints = useCallback(
    (newPoints: GeoPoint[]) => {
      setPoints(newPoints);
      if (onPointsChange) {
        onPointsChange(newPoints);
      }
    },
    [onPointsChange],
  );

  // Initialize Leaflet Map safely in client
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current || mapInstanceRef.current) return;

      const L = await import("leaflet");

      if (!isMounted || !mapContainerRef.current) return;

      // Fix default Leaflet icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Default center: Tashkent, Uzbekistan
      const defaultCenter: [number, number] = [41.311081, 69.240562];
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Setup Base Layer
      const satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Esri World Imagery" },
      );
      const satelliteLabels = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 },
      );

      satelliteLayer.addTo(map);
      satelliteLabels.addTo(map);
      tileLayerRef.current = satelliteLayer;
      labelsLayerRef.current = satelliteLabels;

      mapInstanceRef.current = map;
      setIsMapReady(true);

      // Track mouse position
      map.on("mousemove", (e: any) => {
        setMouseCoord({
          lat: Number(e.latlng.lat.toFixed(6)),
          lon: Number(e.latlng.lng.toFixed(6)),
        });
      });

      // Map Click Handler based on mode
      map.on("click", (e: any) => {
        const clickedPoint: GeoPoint = {
          lat: Number(e.latlng.lat.toFixed(6)),
          lon: Number(e.latlng.lng.toFixed(6)),
        };

        setPoints((prev) => {
          const next = [...prev, clickedPoint];
          if (onPointsChange) onPointsChange(next);
          return next;
        });

        setPinnedCoord(clickedPoint);
      });
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Base Layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    import("leaflet").then((L) => {
      if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
      if (labelsLayerRef.current) map.removeLayer(labelsLayerRef.current);

      if (baseLayer === "satellite") {
        tileLayerRef.current = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19 },
        ).addTo(map);
        labelsLayerRef.current = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19 },
        ).addTo(map);
      } else if (baseLayer === "osm") {
        tileLayerRef.current = L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          { maxZoom: 19 },
        ).addTo(map);
      } else if (baseLayer === "dark") {
        tileLayerRef.current = L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          { maxZoom: 19 },
        ).addTo(map);
      }
    });
  }, [baseLayer]);

  // Redraw Vectors & Markers whenever points or mapMode changes
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return;
    const map = mapInstanceRef.current;

    import("leaflet").then((L) => {
      // Clear previous markers
      markersRef.current.forEach((m) => map.removeLayer(m));
      markersRef.current = [];

      if (polygonLayerRef.current) map.removeLayer(polygonLayerRef.current);
      if (polylineLayerRef.current) map.removeLayer(polylineLayerRef.current);
      if (activePinMarkerRef.current) map.removeLayer(activePinMarkerRef.current);

      const latLngs = points.map((p) => [p.lat, p.lon] as [number, number]);

      // Create custom SVG numbered marker icon
      const createCustomIcon = (index: number) => {
        return L.divIcon({
          className: "geocalc-map-pin",
          html: `
            <div style="
              background: #0d9e79;
              color: #ffffff;
              font-weight: 700;
              font-size: 11px;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2px solid #ffffff;
              box-shadow: 0 4px 10px rgba(0,0,0,0.4);
              cursor: grab;
              user-select: none;
            ">
              ${index + 1}
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
      };

      // Add draggable markers for each point
      points.forEach((p, idx) => {
        const marker = L.marker([p.lat, p.lon], {
          icon: createCustomIcon(idx),
          draggable: true,
        }).addTo(map);

        marker.on("dragend", (e: any) => {
          const newPos = e.target.getLatLng();
          const updated = [...points];
          updated[idx] = {
            lat: Number(newPos.lat.toFixed(6)),
            lon: Number(newPos.lng.toFixed(6)),
          };
          updatePoints(updated);
        });

        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; color: #13241f; padding: 2px;">
            <strong>Nuqta #${idx + 1}</strong><br/>
            Lat: ${p.lat.toFixed(6)}°<br/>
            Lon: ${p.lon.toFixed(6)}°
          </div>
        `);

        markersRef.current.push(marker);
      });

      // Draw Polygon or Polyline
      if (mapMode === "polygon" && latLngs.length >= 3) {
        polygonLayerRef.current = L.polygon(latLngs, {
          color: "#37e6bd",
          weight: 3,
          fillColor: "#0d9e79",
          fillOpacity: 0.35,
          dashArray: "6, 6",
        }).addTo(map);
      } else if (mapMode === "distance" && latLngs.length >= 2) {
        polylineLayerRef.current = L.polyline(latLngs, {
          color: "#55a9ff",
          weight: 4,
          opacity: 0.9,
        }).addTo(map);
      }

      // If pinpoint mode and point clicked
      if (mapMode === "pinpoint" && pinnedCoord) {
        activePinMarkerRef.current = L.circleMarker([pinnedCoord.lat, pinnedCoord.lon], {
          radius: 8,
          color: "#ff756d",
          fillColor: "#ff756d",
          fillOpacity: 0.8,
          weight: 2,
        }).addTo(map);
      }
    });
  }, [points, mapMode, pinnedCoord, isMapReady, updatePoints]);

  // Fit bounds when points are loaded
  const handleFitBounds = () => {
    if (!mapInstanceRef.current || points.length === 0) return;
    import("leaflet").then((L) => {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    });
  };

  // Locate Me
  const handleLocateMe = () => {
    if (typeof navigator !== "undefined" && navigator.geolocation && mapInstanceRef.current) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          mapInstanceRef.current.setView([lat, lon], 17);
        },
        (err) => {
          console.warn("Geolocation error:", err.message);
        },
      );
    }
  };

  // Undo Last Point
  const handleUndo = () => {
    if (points.length > 0) {
      updatePoints(points.slice(0, -1));
    }
  };

  // Clear all
  const handleClear = () => {
    updatePoints([]);
    setPinnedCoord(null);
  };

  // Copy Coordinates
  const handleCopyCoord = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Export GeoJSON
  const handleExportGeoJSON = () => {
    if (points.length < 3) return;
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            name: "GeoCalc Measured Polygon",
            calculatedAt: new Date().toISOString(),
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [...points.map((p) => [p.lon, p.lat]), [points[0].lon, points[0].lat]],
            ],
          },
        },
      ],
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geocalc_polygon_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculated Stats
  const polygonStats = points.length >= 3 ? calculatePolygonProperties(points) : null;
  const lineDistanceMeters =
    points.length >= 2
      ? points.reduce((acc, curr, idx) => {
          if (idx === 0) return 0;
          return acc + calculateVincentyDistanceAndAzimuth(points[idx - 1], curr).distanceMeters;
        }, 0)
      : 0;

  return (
    <div
      className={`relative flex flex-col rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--panel-solid)] shadow-2xl transition-all ${
        isFullscreen ? "fixed inset-4 z-50 h-[calc(100vh-2rem)]" : ""
      }`}
      style={{ height: isFullscreen ? "calc(100vh - 2rem)" : height }}
    >
      {/* Map Control Bar Top */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Modes */}
        <div className="flex items-center gap-1 p-1 bg-[var(--panel-solid)]/90 backdrop-blur-md border border-[var(--border)] rounded-xl shadow-lg pointer-events-auto">
          <button
            onClick={() => setMapMode("polygon")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              mapMode === "polygon"
                ? "bg-[var(--accent)] text-black shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {t.polygon}
          </button>
          <button
            onClick={() => setMapMode("distance")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              mapMode === "distance"
                ? "bg-[var(--blue)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            {t.distance}
          </button>
          <button
            onClick={() => setMapMode("pinpoint")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              mapMode === "pinpoint"
                ? "bg-[var(--danger)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            {t.pinpoint}
          </button>
        </div>

        {/* Right: Layers & Utilities */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--panel-solid)]/90 backdrop-blur-md border border-[var(--border)] rounded-xl shadow-lg pointer-events-auto">
          {/* Layer switcher */}
          <select
            value={baseLayer}
            onChange={(e) => setBaseLayer(e.target.value as BaseLayerType)}
            className="bg-transparent text-xs font-medium text-[var(--text)] px-2 py-1 outline-none border-r border-[var(--border)] cursor-pointer"
          >
            <option value="satellite">🛰️ {t.satellite}</option>
            <option value="osm">🗺️ {t.osm}</option>
            <option value="dark">🌙 {t.dark}</option>
          </select>

          {/* Action buttons */}
          <button
            onClick={handleUndo}
            disabled={points.length === 0}
            title={t.undo}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 transition-all hover:bg-[var(--panel-raised)]"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleClear}
            disabled={points.length === 0}
            title={t.clear}
            className="p-1.5 rounded-lg text-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:opacity-30 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleLocateMe}
            title={t.locateMe}
            className="p-1.5 rounded-lg text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          <button
            onClick={handleFitBounds}
            disabled={points.length === 0}
            title={t.fitBounds}
            className="p-1.5 rounded-lg text-[var(--text)] hover:bg-[var(--panel-raised)] disabled:opacity-30 transition-all"
          >
            <Compass className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-raised)] transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Leaflet Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0 cursor-crosshair" />

      {/* Bottom Live Metrics & Stats Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Real-time Stats */}
        <div className="flex items-center gap-3 px-3.5 py-2 bg-[var(--panel-solid)]/95 backdrop-blur-md border border-[var(--border)] rounded-xl shadow-xl pointer-events-auto">
          {mapMode === "polygon" && polygonStats ? (
            <div className="flex items-center gap-3 text-xs">
              <div>
                <span className="text-[var(--muted)]">{t.area} </span>
                <span className="font-bold text-[var(--accent)] text-sm">
                  {new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
                    polygonStats.areaM2,
                  )}{" "}
                  m²
                </span>
                <span className="text-[var(--muted-2)] ml-1.5 font-medium">
                  ({polygonStats.areaSotix.toFixed(2)} {t.sotix} · {polygonStats.areaHectares.toFixed(3)} {t.ha})
                </span>
              </div>
              <div className="border-l border-[var(--border)] pl-3">
                <span className="text-[var(--muted)]">{t.perimeter} </span>
                <span className="font-semibold text-[var(--text)]">
                  {polygonStats.perimeterMeters.toFixed(1)} m
                </span>
              </div>
              <button
                onClick={handleExportGeoJSON}
                className="ml-2 px-2 py-1 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black transition-all flex items-center gap-1 font-semibold text-[11px]"
              >
                <Download className="w-3 h-3" />
                GeoJSON
              </button>
            </div>
          ) : mapMode === "distance" && points.length >= 2 ? (
            <div className="flex items-center gap-3 text-xs">
              <div>
                <span className="text-[var(--muted)]">{t.totalDistance} </span>
                <span className="font-bold text-[var(--blue)] text-sm">
                  {lineDistanceMeters >= 1000
                    ? `${(lineDistanceMeters / 1000).toFixed(3)} km`
                    : `${lineDistanceMeters.toFixed(1)} m`}
                </span>
              </div>
              <span className="text-[var(--muted-2)] font-medium">
                ({points.length} {t.pointsCount})
              </span>
            </div>
          ) : (
            <div className="text-xs text-[var(--muted)] flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-[var(--accent)] animate-pulse" />
              {t.clickToAdd}
            </div>
          )}
        </div>

        {/* Right: Mouse Coordinate HUD */}
        {mouseCoord && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--panel-solid)]/90 backdrop-blur-md border border-[var(--border)] rounded-xl text-[11px] text-[var(--muted)] font-mono shadow-lg pointer-events-auto">
            <span>
              Lat: <strong className="text-[var(--text)]">{mouseCoord.lat}°</strong>
            </span>
            <span>·</span>
            <span>
              Lon: <strong className="text-[var(--text)]">{mouseCoord.lon}°</strong>
            </span>
            <button
              onClick={() => handleCopyCoord(`${mouseCoord.lat} ${mouseCoord.lon}`)}
              title={t.copy}
              className="p-1 rounded text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-raised)]"
            >
              {isCopied ? <Check className="w-3 h-3 text-[var(--accent)]" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
