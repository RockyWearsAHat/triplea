import React, { useEffect, useMemo, useState } from "react";
import type { MusicianProfile } from "@shared";
import { AppShell, spacing, TripleAApiClient, useScrollReveal } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { SearchBar } from "@shared";
import CategoryBar from "@shared/components/CategoryBar";
import ProductCard from "@shared/components/ProductCard";

interface DiscoveryResult {
  musician: MusicianProfile;
  priceEstimate: number;
  distanceMinutes: number;
}

export function DiscoveryPage() {
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>("All");

  useEffect(() => {
    setError(null);
    setLoading(true);
    api
      .musicDiscovery({ genre: query })
      .then((r) => setResults(r))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [api, query]);

  const genres = useMemo(() => {
    const vals = Array.from(
      new Set(results.flatMap((r) => r.musician.genres)),
    ).sort();
    return ["All", ...vals];
  }, [results]);

  const filtered = useMemo(() => {
    if (!results) return [];
    return results.filter(
      (r) =>
        selectedGenre === "All" ||
        selectedGenre === undefined ||
        (r.musician.genres || []).includes(selectedGenre),
    );
  }, [results, selectedGenre]);

  const contentRef = React.useRef<HTMLDivElement | null>(null);
  useScrollReveal(contentRef, [results.length, loading, query, selectedGenre]);

  return (
    <AppShell title="Find musicians" subtitle="Search and book performers">
      <div
        className={ui.stack}
        style={{ "--stack-gap": `${spacing.md}px` } as React.CSSProperties}
        ref={contentRef}
      >
        <section className={ui.section}>
          <div
            style={{
              display: "flex",
              gap: spacing.sm,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <SearchBar
              placeholder="Search musicians, genres, cities…"
              onSearch={(q) => setQuery(q)}
            />
          </div>

          <div style={{ marginTop: spacing.sm }}>
            <CategoryBar
              categories={genres.map((g) => ({ id: g, label: g }))}
              active={selectedGenre}
              onSelect={(id) => setSelectedGenre(id === "All" ? "All" : id)}
            />
          </div>

          {loading && <p className={ui.help}>Loading…</p>}
          {error && <p className={ui.error}>{error}</p>}

          <div
            style={{
              display: "grid",
              gap: spacing.md,
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            }}
          >
            {filtered.map((r) => (
              <ProductCard
                key={r.musician.id}
                title={r.musician.id}
                subtitle={(r.musician.instruments || []).join(" / ")}
                price={r.priceEstimate}
                onPrimary={() => window.alert(`Requesting ${r.musician.id}`)}
              />
            ))}
          </div>

          {!loading && !error && filtered.length === 0 && (
            <p className={ui.help}>No musicians found.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default DiscoveryPage;
