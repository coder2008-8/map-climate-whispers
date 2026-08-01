import { useEffect, useRef, useState } from "react";

type Props = {
  lat: number;
  lng: number;
  label: string;
  onPick: (place: { name: string; lat: number; lng: number }) => void;
};

declare global {
  interface Window {
    google?: any;
    __initClimateMap?: () => void;
  }
}

let loaderPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
    window.__initClimateMap = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async&callback=__initClimateMap&channel=${channel}`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

export default function LiveMap({ lat, lng, label, onPick }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !mapEl.current || !window.google) return;
        mapRef.current = new window.google.maps.Map(mapEl.current, {
          center: { lat, lng },
          zoom: 9,
          disableDefaultUI: true,
          zoomControl: true,
          styles: MAP_STYLE,
        });
        markerRef.current = new window.google.maps.Marker({
          position: { lat, lng },
          map: mapRef.current,
          title: label,
        });
        mapRef.current.addListener("click", (e: any) => {
          const position = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          onPick({
            name: `${position.lat.toFixed(2)}, ${position.lng.toFixed(2)}`,
            ...position,
          });
        });
        setReady(true);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const position = { lat, lng };
    mapRef.current.panTo(position);
    markerRef.current?.setPosition(position);
    markerRef.current?.setTitle(label);
  }, [lat, lng, label, ready]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return <div ref={mapEl} className="h-full w-full rounded-2xl" />;
}

const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0e2036" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0e2036" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7fa7c9" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1d3d5c" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#15304c" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#071726" }],
  },
];
