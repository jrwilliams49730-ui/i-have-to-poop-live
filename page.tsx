"use client";

import { useEffect, useMemo, useState } from "react";

type UrgencyLevel = {
  label: string;
  radiusMeters: number;
  speedWeight: number;
  qualityWeight: number;
};

type SmartMode = "local" | "driving" | "highway";

type PlaceResult = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number | null;
  openNow: boolean | null;
  distanceMeters: number;
  etaMinutes: number;
  type: string;
};

type GoogleNearbyResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    rating?: number;
    userRatingCount?: number;
    currentOpeningHours?: { openNow?: boolean };
    primaryType?: string;
  }>;
};

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const LIVE_ENABLED = Boolean(GOOGLE_API_KEY);

const URGENCY: UrgencyLevel[] = [
  { label: "Fine", radiusMeters: 12000, speedWeight: 1, qualityWeight: 8 },
  { label: "Soon", radiusMeters: 7000, speedWeight: 2, qualityWeight: 6 },
  { label: "Dangerous", radiusMeters: 4000, speedWeight: 4, qualityWeight: 4 },
  { label: "Code Brown", radiusMeters: 2000, speedWeight: 6, qualityWeight: 2 },
  { label: "Pray For Me", radiusMeters: 900, speedWeight: 8, qualityWeight: 1 },
];

const DEMO_SPOTS: PlaceResult[] = [
  {
    id: "rest-area",
    name: "Interstate Rest Area",
    address: "Demo fallback stop",
    lat: 33.5602,
    lng: -79.0452,
    rating: 4.0,
    userRatingCount: 122,
    openNow: true,
    distanceMeters: 2400,
    etaMinutes: 3,
    type: "rest_stop",
  },
  {
    id: "loves",
    name: "Love's Travel Stop",
    address: "Demo fallback stop",
    lat: 33.5589,
    lng: -79.0413,
    rating: 4.6,
    userRatingCount: 211,
    openNow: true,
    distanceMeters: 5200,
    etaMinutes: 6,
    type: "travel_center",
  },
  {
    id: "target",
    name: "Target",
    address: "Demo fallback stop",
    lat: 33.5638,
    lng: -79.0474,
    rating: 4.7,
    userRatingCount: 450,
    openNow: true,
    distanceMeters: 1200,
    etaMinutes: 4,
    type: "retail",
  },
  {
    id: "hotel",
    name: "Hotel Lobby Bathroom",
    address: "Demo fallback stop",
    lat: 33.5641,
    lng: -79.049,
    rating: 4.9,
    userRatingCount: 78,
    openNow: true,
    distanceMeters: 1400,
    etaMinutes: 5,
    type: "hotel",
  },
  {
    id: "gas",
    name: "Quick Stop Gas",
    address: "Demo fallback stop",
    lat: 33.5573,
    lng: -79.0407,
    rating: 3.2,
    userRatingCount: 49,
    openNow: true,
    distanceMeters: 500,
    etaMinutes: 2,
    type: "gas_station",
  },
];

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function detectContext(speedMph: number): SmartMode {
  if (speedMph >= 45) return "highway";
  if (speedMph >= 10) return "driving";
  return "local";
}

function scorePlace(place: PlaceResult, mode: SmartMode, urgency: UrgencyLevel): number {
  let score = 100;
  score -= place.etaMinutes * urgency.speedWeight;
  score += (place.rating || 0) * urgency.qualityWeight;
  score += place.openNow === true ? 15 : place.openNow === false ? -15 : 0;
  score += Math.min((place.userRatingCount || 0) / 20, 8);

  if (mode === "highway") {
    if (["rest_stop", "travel_center", "gas_station"].includes(place.type)) score += 28;
    if (["hotel", "retail"].includes(place.type)) score -= 8;
  }

  if (mode === "driving") {
    if (["gas_station", "travel_center", "retail"].includes(place.type)) score += 14;
  }

  if (mode === "local") {
    if (["hotel", "retail", "public_bathroom", "department_store", "shopping_mall"].includes(place.type)) score += 18;
    if (place.type === "rest_stop") score -= 20;
  }

  return score;
}

async function fetchLivePlaces(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<PlaceResult[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.currentOpeningHours.openNow",
        "places.primaryType",
      ].join(","),
    },
    body: JSON.stringify({
      includedTypes: [
        "public_bathroom",
        "gas_station",
        "shopping_mall",
        "restaurant",
        "cafe",
        "department_store",
        "library",
        "park",
        "rest_stop",
      ],
      maxResultCount: 20,
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius: radiusMeters,
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Places request failed.");
  }

  const data = (await response.json()) as GoogleNearbyResponse;

  return (data.places || [])
    .map((place) => {
      const placeLat = place.location?.latitude;
      const placeLng = place.location?.longitude;
      const name = place.displayName?.text;

      if (typeof placeLat !== "number" || typeof placeLng !== "number" || !name) return null;

      const distanceMeters = haversineMeters(lat, lng, placeLat, placeLng);

      return {
        id: place.id || `${name}-${placeLat}-${placeLng}`,
        name,
        address: place.formattedAddress || "Address unavailable",
        lat: placeLat,
        lng: placeLng,
        rating: typeof place.rating === "number" ? place.rating : null,
        userRatingCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
        openNow: place.currentOpeningHours?.openNow ?? null,
        distanceMeters,
        etaMinutes: Math.max(1, Math.round(distanceMeters / 80)),
        type: place.primaryType || "unknown",
      } satisfies PlaceResult;
    })
    .filter((place): place is PlaceResult => Boolean(place));
}

export default function HomePage() {
  const [active, setActive] = useState(false);
  const [urgencyIndex, setUrgencyIndex] = useState(2);
  const [coordsLabel, setCoordsLabel] = useState("Waiting for location");
  const [speedMph, setSpeedMph] = useState(0);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [liveResultsLoaded, setLiveResultsLoaded] = useState(false);

  const urgency = URGENCY[urgencyIndex];
  const mode = detectContext(speedMph);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("This browser does not support location. Showing demo results.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const mph = Math.max(0, (position.coords.speed || 0) * 2.23694);
        setSpeedMph(Math.round(mph));
        setCoordsLabel(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
      },
      () => {
        setError("Location permission denied. Showing demo results.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  async function loadNearby() {
    setLoading(true);
    setError("");

    try {
      if (!navigator.geolocation) {
        throw new Error("Geolocation is not available.");
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const mph = Math.max(0, (position.coords.speed || 0) * 2.23694);

      setSpeedMph(Math.round(mph));
      setCoordsLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);

      let baseResults: PlaceResult[];
      if (LIVE_ENABLED) {
        try {
          baseResults = await fetchLivePlaces(lat, lng, urgency.radiusMeters);
          setLiveResultsLoaded(true);
        } catch (liveError) {
          baseResults = DEMO_SPOTS.map((spot) => ({
            ...spot,
            distanceMeters: haversineMeters(lat, lng, spot.lat, spot.lng),
            etaMinutes: Math.max(1, Math.round(haversineMeters(lat, lng, spot.lat, spot.lng) / 80)),
          }));
          setLiveResultsLoaded(false);
          const message = liveError instanceof Error ? liveError.message : "Live search failed.";
          setError(`Live search failed. Showing demo results. ${message}`);
        }
      } else {
        baseResults = DEMO_SPOTS.map((spot) => ({
          ...spot,
          distanceMeters: haversineMeters(lat, lng, spot.lat, spot.lng),
          etaMinutes: Math.max(1, Math.round(haversineMeters(lat, lng, spot.lat, spot.lng) / 80)),
        }));
        setLiveResultsLoaded(false);
        setError("Demo mode. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your hosting settings for real nearby locations.");
      }

      const nextMode = detectContext(Math.round(mph));
      const ranked = [...baseResults].sort(
        (a, b) => scorePlace(b, nextMode, urgency) - scorePlace(a, nextMode, urgency)
      );

      setResults(ranked);
    } catch (err) {
      setLiveResultsLoaded(false);
      setError(err instanceof Error ? `${err.message} Showing demo results.` : "Could not load location.");
      setResults(DEMO_SPOTS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (active) {
      void loadNearby();
    }
  }, [active, urgencyIndex]);

  const best = useMemo(() => results[0], [results]);

  function openDirections(place: PlaceResult) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function renderStars(rating: number | null) {
    const rounded = Math.round(rating || 0);
    return Array.from({ length: 5 }, (_, index) => (index < rounded ? "★" : "☆")).join("");
  }

  if (!active) {
    return (
      <main className="home-shell">
        <button
          className="panic-button"
          aria-label="Emergency restroom search"
          onClick={() => setActive(true)}
        />
      </main>
    );
  }

  return (
    <main className="page">
      <div className="app">
        <div className="row">
          <button className="ghost-button" onClick={() => setActive(false)}>
            Home
          </button>
          <div className="pill-row">
            <div className={`pill ${liveResultsLoaded ? "live" : ""}`}>
              {liveResultsLoaded ? "Live Results" : "Demo Mode"}
            </div>
            <div className="pill">{coordsLabel}</div>
            <div className="pill">{mode}</div>
            <div className="pill">{speedMph} mph</div>
          </div>
        </div>

        <div className="grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="card">
              <div className="section-label">How bad is it?</div>
              <h1 className="title">{urgency.label}</h1>
              <p className="subtitle">Search radius: {(urgency.radiusMeters / 1000).toFixed(1)} km</p>

              <div className="slider-wrap">
                <input
                  className="slider"
                  type="range"
                  min={0}
                  max={URGENCY.length - 1}
                  step={1}
                  value={urgencyIndex}
                  onChange={(event) => setUrgencyIndex(Number(event.target.value))}
                />
                <div className="slider-labels">
                  {URGENCY.map((level) => (
                    <div key={level.label}>{level.label}</div>
                  ))}
                </div>
              </div>

              <div className="helper">
                Add <strong>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</strong> in Vercel to switch from demo to real nearby places.
              </div>

              <div style={{ marginTop: 14 }}>
                <button className="primary-button" onClick={() => void loadNearby()} disabled={loading}>
                  {loading ? "Searching..." : "Refresh Search"}
                </button>
              </div>
            </section>

            <section className="card">
              <div className="section-label">Nearby stops</div>
              {error ? <div className="error">{error}</div> : null}

              <div className="result-list" style={{ marginTop: 12 }}>
                {results.map((spot) => (
                  <div key={spot.id} className="card result-card">
                    <div>
                      <div className="big-name" style={{ fontSize: 26 }}>{spot.name}</div>
                      <div className="subtitle">{spot.address}</div>
                      <div className="result-meta">
                        <span>{spot.etaMinutes} min</span>
                        <span>{(spot.distanceMeters / 1609.34).toFixed(1)} mi</span>
                        <span>{spot.openNow === null ? "Hours unknown" : spot.openNow ? "Open now" : "Closed now"}</span>
                        <span className="stars">{renderStars(spot.rating)}</span>
                      </div>
                    </div>
                    <button className="primary-button" onClick={() => openDirections(spot)}>
                      Go
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="card card-dark">
              <div className="section-label">Smart pick ({mode})</div>
              <h2 className="big-name">{best?.name || "Searching..."}</h2>
              <p className="subtitle" style={{ color: "#d1d5db" }}>
                {best ? `${best.etaMinutes} min away` : "Looking for the best option"}
              </p>
              <div style={{ marginTop: 14 }}>
                <button
                  className="primary-button"
                  style={{ width: "100%" }}
                  onClick={() => best && openDirections(best)}
                  disabled={!best}
                >
                  Take Me There
                </button>
              </div>
            </section>

            <section className="card">
              <div className="section-label">How smart mode works</div>
              <div className="subtitle">
                Highway movement boosts rest stops, travel centers, and gas stations. Slow movement boosts hotels,
                stores, and public spots.
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
