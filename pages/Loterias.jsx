import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function Loterias() {
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadLotteries();
  }, []);

  async function loadLotteries() {
    setLoading(true);
    const data = await base44.entities.LotteryResult.list('-scraped_at', 100);
    setLotteries(data);
    if (data.length > 0) setLastUpdate(data[0].scraped_at);
    setLoading(false);
  }

  const filtered = lotteries.filter(l =>
    l.lottery_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0d1f2d 0%, #002d62 50%, #0d1f2d 100%)",
        padding: "40px 24px 32px",
        borderBottom: "1px solid var(--border)",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 70% 50%, rgba(77,162,255,0.15), transparent 60%)",
          pointerEvents: "none"
        }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: "2rem" }}>🎟️</span>
            <h1 style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
              fontWeight: 900,
              color: "#fff",
              margin: 0
            }}>Resultados Lotería</h1>
          </div>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.9rem", marginBottom: 20 }}>
            Resultados actualizados automáticamente cada hora
          </p>
          {lastUpdate && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(0,231,1,0.1)", border: "1px solid rgba(0,231,1,0.25)",
              borderRadius: 6, padding: "4px 12px", fontSize: "0.75rem", color: "var(--accent)"
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: "pulse 2s infinite" }} />
              Última actualización: {new Date(lastUpdate).toLocaleString('es-DO')}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar lotería..."
          style={{
            width: "100%", maxWidth: 400, padding: "10px 14px",
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: 6, color: "var(--text)", fontSize: "0.88rem",
            outline: "none", marginBottom: 24, fontFamily: "'Outfit', sans-serif"
          }}
        />

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{
              width: 40, height: 40, border: "3px solid var(--border)",
              borderTopColor: "var(--accent)", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 16px"
            }} />
            <p style={{ color: "var(--text2)" }}>Cargando resultados...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text3)" }}>
            {lotteries.length === 0
              ? "Los resultados se cargarán en la próxima actualización automática (cada hora)"
              : "No se encontraron loterías con ese nombre"}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
            gap: 16
          }}>
            {filtered.map((lottery, idx) => (
              <LotteryCard key={idx} lottery={lottery} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LotteryCard({ lottery }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
      transition: "transform 0.15s, box-shadow 0.15s",
      cursor: "pointer",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      {/* Logo area */}
      <div style={{
        background: "#fff",
        height: 120,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", padding: 12
      }}>
        {lottery.logo_url ? (
          <img src={lottery.logo_url} alt={lottery.lottery_name}
            style={{ maxHeight: 80, maxWidth: "100%", objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: "3rem" }}>🎟️</span>
        )}
        {lottery.closing_time && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            background: "#ffd700", color: "#1a1a1a",
            fontSize: "0.65rem", fontWeight: 700,
            padding: "2px 8px", borderRadius: 999
          }}>
            Cierre: {lottery.closing_time}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontWeight: 700, fontSize: "0.92rem", marginBottom: 3 }}>
          {lottery.lottery_name}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginBottom: 12 }}>
          {lottery.draw_date}
        </div>

        {/* Winning numbers */}
        {lottery.numbers?.length > 0 ? (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 }}>
            {lottery.numbers.map((num, i) => (
              <div key={i} style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "linear-gradient(135deg, #ffd700, #f5a623)",
                color: "#1a0800", fontWeight: 900, fontSize: "1rem",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 3px 8px rgba(255,215,0,0.4)"
              }}>
                {num}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "var(--text3)", fontSize: "0.78rem", marginBottom: 12 }}>
            Pendiente
          </div>
        )}

        {/* Previous draws toggle */}
        {lottery.previous_draws?.length > 0 && (
          <>
            <div style={{ height: 1, background: "var(--border)", marginBottom: 10 }} />
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                width: "100%", background: "transparent", border: "none",
                color: "var(--text2)", fontSize: "0.72rem", fontWeight: 700,
                cursor: "pointer", padding: "4px 0", letterSpacing: "0.5px",
                textAlign: "center", fontFamily: "'Outfit', sans-serif"
              }}
            >
              {expanded ? "▲ Ocultar" : "▼ Sorteos Anteriores"}
            </button>
            {expanded && (
              <div style={{ marginTop: 8 }}>
                {lottery.previous_draws.slice(0, 4).map((draw, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "5px 0",
                    borderBottom: i < lottery.previous_draws.length - 1 ? "1px solid var(--border)" : "none"
                  }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text2)" }}>{draw.date}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {draw.numbers?.map((n, j) => (
                        <span key={j} style={{
                          background: "rgba(77,162,255,0.15)",
                          color: "var(--blue)", border: "1px solid rgba(77,162,255,0.3)",
                          borderRadius: 999, padding: "2px 7px",
                          fontSize: "0.7rem", fontWeight: 700
                        }}>{n}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
