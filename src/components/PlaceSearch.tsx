import { useEffect, useRef, useState } from "react";
import { formatCoords, parseCoordinates } from "@/lib/coords";

type Suggestion = { label: string; placeId: string };

export default function PlaceSearch({
  onSelect,
  onSelectCoords,
}: {
  onSelect: (query: string) => void;
  onSelectCoords: (coords: { lat: number; lng: number }) => void;
}) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const tokenRef = useRef<any>(null);

  const coords = parseCoordinates(value);

  useEffect(() => {
    if (coords || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const google = (window as any).google;
        if (!google?.maps?.importLibrary) return;
        const { AutocompleteSuggestion, AutocompleteSessionToken } =
          await google.maps.importLibrary("places");
        tokenRef.current ??= new AutocompleteSessionToken();
        const { suggestions: results } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: value,
            sessionToken: tokenRef.current,
            includedPrimaryTypes: ["(cities)"],
          });
        setSuggestions(
          (results ?? []).slice(0, 5).map((s: any) => ({
            label: s.placePrediction?.text?.text ?? "",
            placeId: s.placePrediction?.placeId ?? "",
          })),
        );
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (query: string) => {
    if (!query.trim()) return;
    const parsed = parseCoordinates(query);
    setValue(query);
    setOpen(false);
    tokenRef.current = null;
    if (parsed) {
      onSelectCoords(parsed);
      return;
    }
    onSelect(query);
  };

  return (
    <div className="relative w-full max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit(value);
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search any city…"
          aria-label="Search any city"
          className="w-full rounded-full border border-border bg-card/70 px-5 py-3 text-sm text-foreground outline-none backdrop-blur placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40"
        />
      </form>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onMouseDown={() => commit(s.label)}
                className="w-full px-5 py-3 text-left text-sm text-popover-foreground transition-colors hover:bg-accent"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
