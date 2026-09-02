"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type { GeoPoint } from "@/lib/legacy-geometry";

export type MapMode = "polygon" | "distance" | "pinpoint";
export type BaseLayerType = "satellite" | "osm" | "dark";

interface InteractiveMapProps {
  initialPoints?: GeoPoint[];
  onPointsChange?: (points: GeoPoint[]) => void;
  height?: string;
  language?: "uz" | "ru" | "en";
  mode?: MapMode;
  baseLayer?: BaseLayerType;
  onBaseLayerChange?: (layer: BaseLayerType) => void;
  hideInternalHUD?: boolean;
}

export default function InteractiveMap({
  initialPoints = [],
  onPointsChange,
  height = "100%",
  language = "uz",
  mode = "polygon",
  baseLayer = "satellite",
  hideInternalHUD = true,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polygonLayerRef = useRef<any>(null);
  const polylineLayerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const labelsLayerRef = useRef<any>(null);

  const [points, setPoints] = useState<GeoPoint[]>(initialPoints);
  const [isMapReady, setIsMapReady] = useState(false);

  // Sync external points
  useEffect(() => {
    setPoints(initialPoints);
  }, [initialPoints]);

  const updatePoints = useCallback(
    (newPoints: GeoPoint[]) => {
      setPoints(newPoints);
      if (onPointsChange) {
        onPointsChange(newPoints);
      }
    },
    [onPointsChange],
  );

  // Initialize Leaflet
  useEffect(() => {
    if (typeof window === "undefined") return;
    let isMounted = true;

    const initMap = async () => {
      const L = (await import("leaflet")).default;

      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const defaultCenter: [number, number] =
        points.length > 0 ? [points[0].lat, points[0].lon] : [41.311081, 69.240562];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: points.length > 0 ? 17 : 14,
        zoomControl: false,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      // Base Tile Layer Loader
      const applyBaseLayer = (layerType: BaseLayerType) => {
        if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
        if (labelsLayerRef.current) map.removeLayer(labelsLayerRef.current);

        if (layerType === "satellite") {
          tileLayerRef.current = L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 19, attribution: "Esri" },
          ).addTo(map);

          labelsLayerRef.current = L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 19, opacity: 0.8 },
          ).addTo(map);
        } else if (layerType === "osm") {
          tileLayerRef.current = L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            { maxZoom: 19, attribution: "OSM" },
          ).addTo(map);
        } else if (layerType === "dark") {
          tileLayerRef.current = L.tileLayer(
            "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            { maxZoom: 19, attribution: "CartoDB" },
          ).addTo(map);
        }
      };

      applyBaseLayer(baseLayer);

      // Map Click Handler
      map.on("click", (e: any) => {
        const newPoint: GeoPoint = {
          lat: parseFloat(e.latlng.lat.toFixed(6)),
          lon: parseFloat(e.latlng.lng.toFixed(6)),
        };

        if (mode === "pinpoint") {
          updatePoints([newPoint]);
        } else {
          setPoints((prev) => {
            const next = [...prev, newPoint];
            if (onPointsChange) onPointsChange(next);
            return next;
          });
        }
      });

      if (isMounted) setIsMapReady(true);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Base Layer on prop change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    import("leaflet").then(({ default: L }) => {
      if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
      if (labelsLayerRef.current) map.removeLayer(labelsLayerRef.current);

      if (baseLayer === "satellite") {
        tileLayerRef.current = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19 },
        ).addTo(map);
        labelsLayerRef.current = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19, opacity: 0.8 },
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

  // Render Markers, Polygons & Polylines
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    import("leaflet").then(({ default: L }) => {
      // Clear old layers
      markersRef.current.forEach((m) => map.removeLayer(m));
      markersRef.current = [];

      if (polygonLayerRef.current) {
        map.removeLayer(polygonLayerRef.current);
        polygonLayerRef.current = null;
      }
      if (polylineLayerRef.current) {
        map.removeLayer(polylineLayerRef.current);
        polylineLayerRef.current = null;
      }

      if (points.length === 0) return;

      const latLngs = points.map((p) => [p.lat, p.lon] as [number, number]);

      // Custom Vertex Marker Icon
      const createMarkerIcon = (index: number) => {
        return L.divIcon({
          className: "custom-geo-marker",
          html: `<div style="width:24px;height:24px;border-radius:9999px;background:#10B981;color:#000;font-weight:900;font-size:10px;display:flex;align-items:center;justify-content:center;border:2px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.5);">${index + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
      };

      // Add draggable vertex markers
      points.forEach((pt, index) => {
        const marker = L.marker([pt.lat, pt.lon], {
          icon: createMarkerIcon(index),
          draggable: true,
        }).addTo(map);

        marker.on("dragend", (e: any) => {
          const latlng = e.target.getLatLng();
          setPoints((prev) => {
            const next = [...prev];
            next[index] = {
              lat: parseFloat(latlng.lat.toFixed(6)),
              lon: parseFloat(latlng.lng.toFixed(6)),
            };
            if (onPointsChange) onPointsChange(next);
            return next;
          });
        });

        markersRef.current.push(marker);
      });

      // Draw Polygon or Polyline
      if (mode === "polygon" && points.length >= 3) {
        polygonLayerRef.current = L.polygon(latLngs, {
          color: "#10B981",
          weight: 2.5,
          fillColor: "#10B981",
          fillOpacity: 0.25,
          dashArray: "4, 4",
        }).addTo(map);
      } else if (points.length >= 2) {
        polylineLayerRef.current = L.polyline(latLngs, {
          color: mode === "distance" ? "#38BDF8" : "#10B981",
          weight: 3,
          dashArray: "6, 6",
        }).addTo(map);
      }
    });
  }, [points, mode, onPointsChange]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[var(--bg)]">
      <div ref={mapContainerRef} className="w-full h-full cursor-crosshair" />
    </div>
  );
}
