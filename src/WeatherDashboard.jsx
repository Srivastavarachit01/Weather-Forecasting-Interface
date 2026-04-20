import { useState, useEffect, useRef } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from "recharts";

// ─── Simulated live data ───────────────────────────────────────────────────────
const CITIES = [
  { id: 1, name: "New York", country: "US", lat: 40.71, lon: -74.01, tz: "EST" },
  { id: 2, name: "London", country: "GB", lat: 51.51, lon: -0.13, tz: "GMT" },
  { id: 3, name: "Tokyo", country: "JP", lat: 35.68, lon: 139.69, tz: "JST" },
  { id: 4, name: "Dubai", country: "AE", lat: 25.2, lon: 55.27, tz: "GST" },
  { id: 5, name: "Sydney", country: "AU", lat: -33.87, lon: 151.21, tz: "AEDT" },
  { id: 6, name: "Mumbai", country: "IN", lat: 19.08, lon: 72.88, tz: "IST" },
  { id: 7, name: "São Paulo", country: "BR", lat: -23.55, lon: -46.63, tz: "BRT" },
  { id: 8, name: "Berlin", country: "DE", lat: 52.52, lon: 13.4, tz: "CET" },
];

const CONDITIONS = ["Clear", "Cloudy", "Rain", "Partly Cloudy", "Thunderstorm", "Fog", "Snow", "Windy"];
const COND_ICONS = { Clear: "☀️", Cloudy: "☁️", Rain: "🌧️", "Partly Cloudy": "⛅", Thunderstorm: "⛈️", Fog: "🌫️", Snow: "❄️", Windy: "💨" };

function rnd(min, max, dec = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dec));
}

function generateCityData(city) {
  const baseTemps = { "New York": 18, London: 12, Tokyo: 22, Dubai: 38, Sydney: 20, Mumbai: 32, "São Paulo": 25, Berlin: 14 };
  const base = baseTemps[city.name] ?? 20;
  return {
    ...city,
    temp: rnd(base - 5, base + 5),
    feels_like: rnd(base - 7, base + 3),
    humidity: rnd(30, 95),
    wind_speed: rnd(0, 45),
    pressure: rnd(990, 1030),
    visibility: rnd(2, 25),
    condition: CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)],
    uv_index: rnd(0, 11),
    aqi: Math.floor(rnd(10, 180)),
    last_updated: new Date().toISOString(),
  };
}

function generateHistoricalData() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, "0")}:00`,
    temp: rnd(14, 28),
    humidity: rnd(40, 85),
    wind: rnd(5, 35),
    pressure: rnd(1005, 1025),
  }));
}

function generatePipelineRuns() {
  const now = Date.now();
  return Array.from({ length: 12 }, (_, i) => ({
    id: `run_${1000 + i}`,
    dag: i % 3 === 0 ? "weather_etl_hourly" : i % 3 === 1 ? "weather_aggregate_daily" : "weather_alerts",
    status: i === 11 ? "running" : i % 7 === 0 ? "failed" : "success",
    duration: rnd(12, 180, 0),
    records: Math.floor(rnd(500, 8000, 0)),
    started: new Date(now - (11 - i) * 3600000).toISOString(),
    cities_processed: Math.floor(rnd(40, 64, 0)),
  }));
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    success: { color: "#00ff88", bg: "rgba(0,255,136,0.1)", label: "SUCCESS" },
    failed: { color: "#ff4757", bg: "rgba(255,71,87,0.1)", label: "FAILED" },
    running: { color: "#ffa502", bg: "rgba(255,165,2,0.1)", label: "RUNNING" },
  };
  const s = map[status] ?? map.success;
  return (
    <span style={{
      color: s.color, background: s.bg, border: `1px solid ${s.color}40`,
      padding: "2px 8px", borderRadius: 3, fontSize: 10, fontFamily: "monospace",
      fontWeight: 700, letterSpacing: 1,
    }}>{s.label}</span>
  );
}

function MetricCard({ label, value, unit, delta, icon, accent }) {
  const up = delta >= 0;
  return (
    <div style={{
      background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)",
      border: `1px solid ${accent}30`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 6, padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 6,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 12, right: 14, fontSize: 22, opacity: 0.15 }}>{icon}</div>
      <div style={{ fontSize: 10, color: "#8b949e", letterSpacing: 2, textTransform: "uppercase", fontFamily: "monospace" }}>{label}</div>
      <div style={{ fontSize: 28, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "#e6edf3" }}>
        {value}<span style={{ fontSize: 14, color: "#8b949e", marginLeft: 3 }}>{unit}</span>
      </div>
      {delta !== undefined && (
        <div style={{ fontSize: 11, color: up ? "#3fb950" : "#f85149", fontFamily: "monospace" }}>
          {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}{unit} from last hr
        </div>
      )}
    </div>
  );
}

function CityCard({ city, selected, onClick }) {
  const aq = city.aqi < 50 ? "#3fb950" : city.aqi < 100 ? "#ffa502" : "#f85149";
  return (
    <div onClick={() => onClick(city)} style={{
      background: selected ? "rgba(88,166,255,0.08)" : "#0d1117",
      border: `1px solid ${selected ? "#58a6ff" : "#21262d"}`,
      borderRadius: 6, padding: "12px 14px", cursor: "pointer",
      transition: "all 0.2s", display: "flex", flexDirection: "column", gap: 5,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: "#e6edf3" }}>
          {city.name}
        </div>
        <span style={{ fontSize: 16 }}>{COND_ICONS[city.condition] ?? "🌡️"}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#58a6ff", fontFamily: "'Syne', sans-serif" }}>
        {city.temp.toFixed(1)}°C
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8b949e", fontFamily: "monospace" }}>
        <span>💧 {city.humidity.toFixed(0)}%</span>
        <span>💨 {city.wind_speed.toFixed(0)}km/h</span>
        <span style={{ color: aq }}>AQI {city.aqi}</span>
      </div>
      <div style={{ fontSize: 9, color: "#484f58", fontFamily: "monospace", letterSpacing: 0.5 }}>{city.condition.toUpperCase()}</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6, padding: "10px 14px" }}>
      <div style={{ color: "#8b949e", fontSize: 11, fontFamily: "monospace", marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontSize: 12, fontFamily: "monospace" }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function WeatherDashboard() {
  const [cities, setCities] = useState(() => CITIES.map(generateCityData));
  const [selectedCity, setSelectedCity] = useState(null);
  const [history, setHistory] = useState(generateHistoricalData);
  const [pipeline, setPipeline] = useState(generatePipelineRuns);
  const [tab, setTab] = useState("overview");
  const [tick, setTick] = useState(0);
  const [recordsProcessed, setRecordsProcessed] = useState(1284720);
  const [apiCalls, setApiCalls] = useState(47382);
  const [uptime] = useState("99.94%");
  const timerRef = useRef(null);

  // Live refresh every 4s
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCities(CITIES.map(generateCityData));
      setHistory(generateHistoricalData());
      setPipeline(generatePipelineRuns());
      setRecordsProcessed(p => p + Math.floor(rnd(200, 800, 0)));
      setApiCalls(p => p + Math.floor(rnd(10, 60, 0)));
      setTick(t => t + 1);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, []);

  const avg = (arr, key) => arr.reduce((s, c) => s + c[key], 0) / arr.length;
  const avgTemp = avg(cities, "temp");
  const avgHumidity = avg(cities, "humidity");
  const avgWind = avg(cities, "wind_speed");

  const scatterData = cities.map(c => ({ x: c.humidity, y: c.temp, name: c.name }));

  const tabs = ["overview", "cities", "pipeline", "analytics"];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#010409",
      color: "#e6edf3",
      fontFamily: "'DM Sans', sans-serif",
      fontSize: 13,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .city-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(100%)} }
        .live-dot { width:8px; height:8px; border-radius:50%; background:#00ff88; animation:pulse 1.5s infinite; display:inline-block; }
        .tab-btn { background:none; border:none; color:#8b949e; cursor:pointer; padding:8px 16px; font-family:inherit; font-size:12px; font-weight:600; letter-spacing:1px; text-transform:uppercase; border-bottom:2px solid transparent; transition:all 0.2s; }
        .tab-btn.active { color:#58a6ff; border-bottom-color:#58a6ff; }
        .tab-btn:hover { color:#e6edf3; }
      `}</style>

      {/* Header */}
      <div style={{
        background: "linear-gradient(90deg, #0d1117 0%, #161b22 100%)",
        borderBottom: "1px solid #21262d",
        padding: "0 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 56,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 32, height: 32, background: "linear-gradient(135deg, #58a6ff, #1f6feb)",
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>🌐</div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>
              WeatherFlow
            </div>
            <div style={{ fontSize: 9, color: "#484f58", fontFamily: "monospace", letterSpacing: 2 }}>
              ETL PIPELINE · ANALYTICS DASHBOARD
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {tabs.map(t => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#8b949e", fontFamily: "monospace" }}>
            <div className="live-dot" /> LIVE · 64 cities
          </div>
          <div style={{
            background: "#161b22", border: "1px solid #21262d", borderRadius: 4,
            padding: "4px 10px", fontSize: 10, fontFamily: "monospace", color: "#3fb950",
          }}>
            ● Airflow DAGs: 3/3
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* KPI strip */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 10,
            }}>
              {[
                { label: "Cities Monitored", value: "64", unit: "", icon: "🌍", accent: "#58a6ff" },
                { label: "Records Processed", value: (recordsProcessed / 1e6).toFixed(3), unit: "M", icon: "🗄️", accent: "#3fb950" },
                { label: "API Calls Today", value: apiCalls.toLocaleString(), unit: "", icon: "⚡", accent: "#ffa502" },
                { label: "Avg Global Temp", value: avgTemp.toFixed(1), unit: "°C", icon: "🌡️", accent: "#ff6b6b", delta: rnd(-1, 1) },
                { label: "Pipeline Uptime", value: uptime, unit: "", icon: "🔄", accent: "#a371f7" },
                { label: "Avg Humidity", value: avgHumidity.toFixed(1), unit: "%", icon: "💧", accent: "#39d0e0" },
              ].map(m => <MetricCard key={m.label} {...m} />)}
            </div>

            {/* Charts row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

              {/* Temperature trend */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>24h Temperature Profile</div>
                    <div style={{ fontSize: 10, color: "#8b949e", fontFamily: "monospace", letterSpacing: 1 }}>GLOBAL AVERAGE · °C</div>
                  </div>
                  <div style={{ fontSize: 10, color: "#3fb950", fontFamily: "monospace" }}>UPDATING LIVE</div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#58a6ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                    <XAxis dataKey="hour" tick={{ fill: "#484f58", fontSize: 10, fontFamily: "monospace" }} interval={5} />
                    <YAxis tick={{ fill: "#484f58", fontSize: 10, fontFamily: "monospace" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="temp" stroke="#58a6ff" strokeWidth={2} fill="url(#tempGrad)" name="Temp °C" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Humidity vs Temp scatter */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: 20 }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Humidity × Temperature</div>
                  <div style={{ fontSize: 10, color: "#8b949e", fontFamily: "monospace", letterSpacing: 1 }}>CORRELATION · ALL CITIES</div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                    <XAxis dataKey="x" name="Humidity" unit="%" tick={{ fill: "#484f58", fontSize: 10, fontFamily: "monospace" }} />
                    <YAxis dataKey="y" name="Temp" unit="°C" tick={{ fill: "#484f58", fontSize: 10, fontFamily: "monospace" }} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />
                    <Scatter data={scatterData} fill="#a371f7" fillOpacity={0.8} r={6} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Wind + Pressure */}
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Wind & Pressure — 24h History</div>
                  <div style={{ fontSize: 10, color: "#8b949e", fontFamily: "monospace", letterSpacing: 1 }}>DUAL AXIS ANALYSIS</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis dataKey="hour" tick={{ fill: "#484f58", fontSize: 10, fontFamily: "monospace" }} interval={5} />
                  <YAxis yAxisId="left" tick={{ fill: "#ffa502", fontSize: 10, fontFamily: "monospace" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#39d0e0", fontSize: 10, fontFamily: "monospace" }} domain={[995, 1030]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line yAxisId="left" type="monotone" dataKey="wind" stroke="#ffa502" strokeWidth={2} dot={false} name="Wind km/h" />
                  <Line yAxisId="right" type="monotone" dataKey="pressure" stroke="#39d0e0" strokeWidth={2} dot={false} name="Pressure hPa" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* City snapshot grid */}
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Live City Snapshots</div>
              <div className="city-grid">
                {cities.slice(0, 8).map(c => (
                  <CityCard key={c.id} city={c} selected={selectedCity?.id === c.id} onClick={setSelectedCity} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CITIES TAB */}
        {tab === "cities" && (
          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 10, color: "#484f58", fontFamily: "monospace", letterSpacing: 2, marginBottom: 4 }}>ALL CITIES · {cities.length}</div>
              {cities.map(c => (
                <CityCard key={c.id} city={c} selected={selectedCity?.id === c.id} onClick={setSelectedCity} />
              ))}
            </div>

            <div>
              {selectedCity ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{
                    background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: 24,
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                  }}>
                    <div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28 }}>{selectedCity.name}</div>
                      <div style={{ fontSize: 11, color: "#8b949e", fontFamily: "monospace", letterSpacing: 2, marginTop: 2 }}>
                        {selectedCity.country} · {selectedCity.lat.toFixed(2)}°N {selectedCity.lon.toFixed(2)}°E · {selectedCity.tz}
                      </div>
                      <div style={{ fontSize: 48, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "#58a6ff", marginTop: 8 }}>
                        {selectedCity.temp.toFixed(1)}<span style={{ fontSize: 22 }}>°C</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#8b949e", marginTop: 4 }}>
                        {COND_ICONS[selectedCity.condition]} {selectedCity.condition} · Feels like {selectedCity.feels_like.toFixed(1)}°C
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, minWidth: 280 }}>
                      {[
                        { l: "Humidity", v: selectedCity.humidity.toFixed(0) + "%", c: "#39d0e0" },
                        { l: "Wind Speed", v: selectedCity.wind_speed.toFixed(0) + " km/h", c: "#ffa502" },
                        { l: "Pressure", v: selectedCity.pressure.toFixed(0) + " hPa", c: "#a371f7" },
                        { l: "Visibility", v: selectedCity.visibility.toFixed(0) + " km", c: "#3fb950" },
                        { l: "UV Index", v: selectedCity.uv_index.toFixed(1), c: "#ff6b6b" },
                        { l: "Air Quality", v: "AQI " + selectedCity.aqi, c: selectedCity.aqi < 50 ? "#3fb950" : selectedCity.aqi < 100 ? "#ffa502" : "#f85149" },
                      ].map(m => (
                        <div key={m.l} style={{
                          background: "#161b22", border: "1px solid #21262d", borderRadius: 6, padding: "10px 14px",
                        }}>
                          <div style={{ fontSize: 9, color: "#484f58", fontFamily: "monospace", letterSpacing: 1.5, textTransform: "uppercase" }}>{m.l}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: m.c, fontFamily: "'Syne', sans-serif", marginTop: 3 }}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: 20 }}>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, marginBottom: 14 }}>24h Temperature Trend</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a371f7" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#a371f7" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                        <XAxis dataKey="hour" tick={{ fill: "#484f58", fontSize: 10, fontFamily: "monospace" }} interval={5} />
                        <YAxis tick={{ fill: "#484f58", fontSize: 10, fontFamily: "monospace" }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="temp" stroke="#a371f7" strokeWidth={2} fill="url(#cg)" name="Temp °C" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{
                    background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: 16,
                    fontFamily: "monospace", fontSize: 11,
                  }}>
                    <div style={{ color: "#484f58", marginBottom: 10, letterSpacing: 2, fontSize: 9 }}>FASTAPI RESPONSE PAYLOAD · /api/v1/weather/{selectedCity.name.toLowerCase().replace(" ", "_")}</div>
                    <pre style={{ color: "#8b949e", lineHeight: 1.8 }}>{JSON.stringify({
                      city: selectedCity.name, country: selectedCity.country,
                      coordinates: { lat: selectedCity.lat, lon: selectedCity.lon },
                      temperature: { current: selectedCity.temp, feels_like: selectedCity.feels_like, unit: "celsius" },
                      atmosphere: { humidity: selectedCity.humidity, pressure: selectedCity.pressure, visibility: selectedCity.visibility },
                      wind: { speed: selectedCity.wind_speed, unit: "km/h" },
                      condition: selectedCity.condition, uv_index: selectedCity.uv_index, aqi: selectedCity.aqi,
                      last_updated: selectedCity.last_updated,
                    }, null, 2)}</pre>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 400, color: "#484f58", fontFamily: "monospace", fontSize: 12, flexDirection: "column", gap: 8,
                }}>
                  <div style={{ fontSize: 32 }}>🌐</div>
                  <div>Select a city to view detailed data</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PIPELINE TAB */}
        {tab === "pipeline" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* DAG Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                { name: "weather_etl_hourly", schedule: "@hourly", tasks: 8, success_rate: 97.2, color: "#58a6ff", desc: "Fetches weather data from OpenWeather API for 64 cities, validates, transforms, and loads into PostgreSQL." },
                { name: "weather_aggregate_daily", schedule: "@daily", tasks: 5, success_rate: 99.1, color: "#3fb950", desc: "Aggregates hourly city records into daily summaries with min/max/avg statistics per city." },
                { name: "weather_alerts", schedule: "*/15 * * * *", tasks: 3, success_rate: 98.7, color: "#ffa502", desc: "Monitors threshold breaches (extreme heat, storms) and triggers notifications via FastAPI webhooks." },
              ].map(dag => (
                <div key={dag.name} style={{
                  background: "#0d1117", border: `1px solid ${dag.color}30`, borderTop: `3px solid ${dag.color}`,
                  borderRadius: 8, padding: 20,
                }}>
                  <div style={{ fontFamily: "monospace", fontSize: 12, color: dag.color, fontWeight: 700, marginBottom: 4 }}>{dag.name}</div>
                  <div style={{ fontSize: 10, color: "#8b949e", fontFamily: "monospace", marginBottom: 12 }}>schedule: {dag.schedule}</div>
                  <div style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.6, marginBottom: 14 }}>{dag.desc}</div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 10, fontFamily: "monospace", color: "#484f58" }}>
                      <span style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>{dag.tasks}</span> tasks
                    </div>
                    <div style={{ fontSize: 10, fontFamily: "monospace", color: "#484f58" }}>
                      <span style={{ color: "#3fb950", fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>{dag.success_rate}%</span> success
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ marginTop: 10, height: 4, background: "#21262d", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${dag.success_rate}%`, background: dag.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Run Log */}
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, overflow: "hidden" }}>
              <div style={{
                padding: "14px 20px", borderBottom: "1px solid #21262d",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Pipeline Run History</div>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: "#8b949e" }}>Last 12 runs · auto-refreshing</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#161b22" }}>
                    {["Run ID", "DAG", "Status", "Duration (s)", "Records", "Cities", "Started"].map(h => (
                      <th key={h} style={{
                        padding: "10px 16px", textAlign: "left",
                        fontSize: 9, fontFamily: "monospace", color: "#484f58", letterSpacing: 1.5,
                        fontWeight: 600, textTransform: "uppercase", borderBottom: "1px solid #21262d",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pipeline.map((run, i) => (
                    <tr key={run.id} style={{ borderBottom: "1px solid #161b22", background: i % 2 === 0 ? "transparent" : "#0a0e14" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 11, color: "#58a6ff" }}>{run.id}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 10, color: "#8b949e" }}>{run.dag}</td>
                      <td style={{ padding: "10px 16px" }}><StatusBadge status={run.status} /></td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 11, color: "#e6edf3" }}>{run.duration}s</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 11, color: "#3fb950" }}>{run.records.toLocaleString()}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 11, color: "#a371f7" }}>{run.cities_processed}/64</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 10, color: "#484f58" }}>
                        {new Date(run.started).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Architecture diagram */}
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: 24 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 18 }}>System Architecture</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, flexWrap: "wrap" }}>
                {[
                  { label: "OpenWeather API", sub: "64 cities · hourly", icon: "🌐", color: "#39d0e0" },
                  null,
                  { label: "Apache Airflow", sub: "ETL Orchestration", icon: "🔄", color: "#ffa502" },
                  null,
                  { label: "FastAPI", sub: "REST Backend", icon: "⚡", color: "#3fb950" },
                  null,
                  { label: "PostgreSQL", sub: "Time-series store", icon: "🗄️", color: "#a371f7" },
                  null,
                  { label: "React Dashboard", sub: "Real-time UI", icon: "📊", color: "#58a6ff" },
                ].map((node, i) =>
                  node === null ? (
                    <div key={i} style={{ fontSize: 20, color: "#30363d", padding: "0 4px" }}>──▶</div>
                  ) : (
                    <div key={node.label} style={{
                      background: `${node.color}10`, border: `1px solid ${node.color}40`,
                      borderRadius: 8, padding: "14px 16px", textAlign: "center", minWidth: 120,
                    }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{node.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: node.color, fontFamily: "'Syne', sans-serif" }}>{node.label}</div>
                      <div style={{ fontSize: 9, color: "#484f58", fontFamily: "monospace", marginTop: 2, letterSpacing: 0.5 }}>{node.sub}</div>
                    </div>
                  )
                )}
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["Docker Compose", "PostgreSQL 15", "Airflow 2.7", "FastAPI 0.104", "React 18", "Recharts"].map(tag => (
                  <span key={tag} style={{
                    background: "#161b22", border: "1px solid #30363d", borderRadius: 3,
                    padding: "3px 10px", fontSize: 10, fontFamily: "monospace", color: "#8b949e",
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tab === "analytics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

              {/* Temp by city bar */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: 20 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Temperature by City · Current</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cities} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#484f58", fontSize: 10, fontFamily: "monospace" }} unit="°C" />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#8b949e", fontSize: 10, fontFamily: "monospace" }} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="temp" name="Temp °C" fill="#58a6ff" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Humidity bar */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: 20 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Humidity by City · Current</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cities} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#484f58", fontSize: 10, fontFamily: "monospace" }} unit="%" />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#8b949e", fontSize: 10, fontFamily: "monospace" }} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="humidity" name="Humidity %" fill="#39d0e0" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Full 24h multi-series */}
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: 20 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, marginBottom: 14 }}>24h Multi-Variable Analysis</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis dataKey="hour" tick={{ fill: "#484f58", fontSize: 10, fontFamily: "monospace" }} interval={3} />
                  <YAxis tick={{ fill: "#484f58", fontSize: 10, fontFamily: "monospace" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="temp" stroke="#58a6ff" strokeWidth={2} dot={false} name="Temp °C" />
                  <Line type="monotone" dataKey="humidity" stroke="#39d0e0" strokeWidth={2} dot={false} name="Humidity %" />
                  <Line type="monotone" dataKey="wind" stroke="#ffa502" strokeWidth={2} dot={false} name="Wind km/h" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Ranking table */}
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #21262d" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>City Rankings — All Metrics</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#161b22" }}>
                    {["#", "City", "Temp °C", "Humidity %", "Wind km/h", "Pressure hPa", "UV Index", "AQI", "Condition"].map(h => (
                      <th key={h} style={{
                        padding: "10px 14px", textAlign: "left",
                        fontSize: 9, fontFamily: "monospace", color: "#484f58", letterSpacing: 1.5,
                        textTransform: "uppercase", borderBottom: "1px solid #21262d",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...cities].sort((a, b) => b.temp - a.temp).map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #161b22" }}>
                      <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 11, color: "#484f58" }}>{i + 1}</td>
                      <td style={{ padding: "9px 14px", fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700, color: "#e6edf3" }}>{c.name}</td>
                      <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 11, color: "#ff6b6b", fontWeight: 700 }}>{c.temp.toFixed(1)}</td>
                      <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 11, color: "#39d0e0" }}>{c.humidity.toFixed(0)}</td>
                      <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 11, color: "#ffa502" }}>{c.wind_speed.toFixed(0)}</td>
                      <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 11, color: "#8b949e" }}>{c.pressure.toFixed(0)}</td>
                      <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 11, color: "#a371f7" }}>{c.uv_index.toFixed(1)}</td>
                      <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 11, color: c.aqi < 50 ? "#3fb950" : c.aqi < 100 ? "#ffa502" : "#f85149" }}>{c.aqi}</td>
                      <td style={{ padding: "9px 14px", fontSize: 11, color: "#8b949e" }}>{COND_ICONS[c.condition]} {c.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div style={{
        borderTop: "1px solid #21262d", padding: "10px 28px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 24, background: "#0d1117",
      }}>
        <div style={{ fontSize: 10, fontFamily: "monospace", color: "#484f58" }}>
          WeatherFlow · Apache Airflow + FastAPI + React + PostgreSQL + Docker
        </div>
        <div style={{ fontSize: 10, fontFamily: "monospace", color: "#484f58" }}>
          Refresh #{tick} · {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}