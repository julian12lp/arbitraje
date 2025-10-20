// Hooks desde el objeto global React (sin imports)
const { useMemo, useState, useEffect } = React;

// Web app: USD -> USDT -> ARS -> USD arbitrage checker
// - USDT/USD: usa SIEMPRE el menor ASK (o precio manual)
// - USDT/ARS: permite elegir COMPRA(ASK) o VENTA(BID) (o precio manual)
// - USD final: DolarAPI oficial (venta) o valor manual

const usdtUsdAllowed = [
  "buenbit",
  "satoshitango",
  "letsbit",
  "binancep2p",
  "fiwind",
  "belo",
  "tiendacrypto",
];

const usdtArsAllowed = [
  "buenbit",
  "ripio",
  "ripioexchange",
  "satoshitango",
  "decrypto",
  "letsbit",
  "binancep2p",
  "fiwind",
  "lemoncash",
  "okexp2p",
  "paxfulp2p",
  "belo",
  "tiendacrypto",
  "bybitp2p",
  "kucoinp2p",
  "bitgetp2p",
  "bingxp2p",
  "bitsoalpha",
  "lemoncashp2p",
  "cocoscrypto",
  "mexcp2p",
];

function Section({ title, children }) {
  return (
    <div className="bg-white/70 dark:bg-white/10 backdrop-blur rounded-2xl shadow p-5 border border-slate-200 dark:border-slate-700">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="inline-block text-xs px-2 py-1 rounded-full border border-slate-300 dark:border-slate-600 mr-2 mb-2">
      {children}
    </span>
  );
}

function Arbitraje() {
  // Dark mode
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Selección de exchanges
  const [selectedUsdUsd, setSelectedUsdUsd] = useState(() => {
    const init = {};
    usdtUsdAllowed.forEach((k) => (init[k] = true));
    return init;
  });
  const [selectedUsdArs, setSelectedUsdArs] = useState(() => {
    const init = {};
    usdtArsAllowed.forEach((k) => (init[k] = true));
    return init;
  });

  // USDT/USD: precio automático (API) o manual — SIEMPRE min ASK
  const [priceModeUsdUsd, setPriceModeUsdUsd] = useState("auto"); // 'auto' | 'manual'
  const [manualUsdUsd, setManualUsdUsd] = useState("");

  // USDT/ARS: precio automático o manual + lado (compra/venta)
  const [sideUsdArs, setSideUsdArs] = useState("venta"); // 'compra' | 'venta'
  const [priceModeUsdArs, setPriceModeUsdArs] = useState("auto"); // 'auto' | 'manual'
  const [manualUsdArs, setManualUsdArs] = useState("");

  // USD final: API oficial o manual
  const [rateMode, setRateMode] = useState("api"); // 'api' | 'manual'
  const [manualVenta, setManualVenta] = useState("");

  // Estado general
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Datos crudos (debug)
  const [usdtUsdData, setUsdtUsdData] = useState(null);
  const [usdtArsData, setUsdtArsData] = useState(null);
  const [dolarOficial, setDolarOficial] = useState(null);

  // Resultado
  const [result, setResult] = useState(null);

  const handleToggle = (group, key) => {
    if (group === "usdUsd") {
      setSelectedUsdUsd((s) => ({ ...s, [key]: !s[key] }));
    } else {
      setSelectedUsdArs((s) => ({ ...s, [key]: !s[key] }));
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Traemos de CriptoYa lo necesario según modo
      let d1 = null, d2 = null;

      if (priceModeUsdUsd === "auto") {
        const r1 = await fetch("https://criptoya.com/api/USDT/USD/0.1");
        if (!r1.ok) throw new Error("Error al consultar USDT/USD en CriptoYa");
        d1 = await r1.json();
        setUsdtUsdData(d1);
      } else {
        setUsdtUsdData(null);
      }

      if (priceModeUsdArs === "auto") {
        const r2 = await fetch("https://criptoya.com/api/USDT/ARS/0.1");
        if (!r2.ok) throw new Error("Error al consultar USDT/ARS en CriptoYa");
        d2 = await r2.json();
        setUsdtArsData(d2);
      } else {
        setUsdtArsData(null);
      }

      // Paso 1: USDT/USD — SIEMPRE min ASK (o manual)
      let step1Exchange = "Manual";
      let step1Ask = Number(manualUsdUsd);
      if (priceModeUsdUsd === "auto") {
        const candidates = Object.entries(d1 || {})
          .filter(([ex, obj]) => selectedUsdUsd[ex] && obj && typeof obj.ask === "number")
          .map(([ex, obj]) => ({ exchange: ex, ask: obj.ask }));

        if (!candidates.length) throw new Error("USDT/USD: no hay exchanges seleccionados con 'ask' válido");

        const best = candidates.reduce((min, cur) => (cur.ask < min.ask ? cur : min));
        step1Exchange = best.exchange;
        step1Ask = best.ask;
      } else {
        if (!step1Ask || isNaN(step1Ask) || step1Ask <= 0) {
          throw new Error("USDT/USD: ingresá un precio manual (ask) válido");
        }
      }

      // 1 USD -> USDT
      const usdtObtained = 1 / step1Ask;

      // Paso 2: USDT/ARS — según lado (compra=ASK min, venta=BID máx) o manual
      let step2Exchange = "Manual";
      let step2Price = Number(manualUsdArs);
      if (priceModeUsdArs === "auto") {
        const candidates = Object.entries(d2 || {})
          .filter(([ex, obj]) => selectedUsdArs[ex] && obj && typeof obj.ask === "number" && typeof obj.bid === "number")
          .map(([ex, obj]) => ({ exchange: ex, ask: obj.ask, bid: obj.bid }));

        if (!candidates.length) throw new Error("USDT/ARS: no hay exchanges seleccionados con datos válidos");

        if (sideUsdArs === "venta") {
          const best = candidates.reduce((max, cur) => (cur.bid > max.bid ? cur : max));
          step2Exchange = best.exchange;
          step2Price = best.bid;
        } else {
          const best = candidates.reduce((min, cur) => (cur.ask < min.ask ? cur : min));
          step2Exchange = best.exchange;
          step2Price = best.ask;
        }
      } else {
        if (!step2Price || isNaN(step2Price) || step2Price <= 0) {
          throw new Error("USDT/ARS: ingresá un precio manual válido");
        }
      }

      // USDT -> ARS (si elegiste compra en ARS, este paso semánticamente sería al revés,
      // pero para el cálculo mantenemos: ARS = USDT * precio seleccionado)
      const arsObtained = usdtObtained * step2Price;

      // Paso 3: Dólar oficial o manual (venta)
      let nombre, venta;
      if (rateMode === "api") {
        const r3 = await fetch("https://dolarapi.com/v1/dolares/oficial");
        if (!r3.ok) throw new Error("Error al consultar DolarAPI oficial");
        const d3 = await r3.json();
        setDolarOficial(d3);
        nombre = d3?.nombre ?? "oficial";
        venta = Number(d3?.venta);
        if (!venta || isNaN(venta)) throw new Error("DolarAPI: 'venta' inválido");
      } else {
        nombre = "Manual";
        venta = Number(manualVenta);
        if (!venta || isNaN(venta) || venta <= 0) {
          throw new Error("Ingresá un valor manual válido (ARS por USD)");
        }
      }

      const usdFinal = arsObtained / venta;
      const profitPct = (usdFinal - 1) * 100;
      const timestamp = new Intl.DateTimeFormat("es-AR", {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date());

      setResult({
        step1: { exchange: step1Exchange, ask: step1Ask, usdtObtained },
        step2: { exchange: step2Exchange, side: sideUsdArs, price: step2Price, arsObtained },
        step3: { nombre, venta, usdFinal },
        profitPct,
        timestamp,
      });
    } catch (e) {
      console.error(e);
      setError(e.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const allUsdUsdChecked = useMemo(
    () => usdtUsdAllowed.every((k) => selectedUsdUsd[k]),
    [selectedUsdUsd]
  );
  const allUsdArsChecked = useMemo(
    () => usdtArsAllowed.every((k) => selectedUsdArs[k]),
    [selectedUsdArs]
  );

  const toggleAll = (group, value) => {
    if (group === "usdUsd") {
      const next = {};
      usdtUsdAllowed.forEach((k) => (next[k] = value));
      setSelectedUsdUsd(next);
    } else {
      const next = {};
      usdtArsAllowed.forEach((k) => (next[k] = value));
      setSelectedUsdArs(next);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 p-6">
      <div className="max-w-5xl mx-auto grid gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Arbitraje USD → USDT → ARS → USD</h1>
          <div className="flex items-center gap-3">
            <div className="text-sm opacity-80">Monto inicial: <strong>1 USD</strong></div>
            <button
              onClick={() => setDark((d) => !d)}
              className="px-3 py-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-800 hover:shadow"
              title="Cambiar tema"
            >
              {dark ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>
        </header>

        {/* USDT/USD */}
        <Section title="1) Selección de exchanges (USDT/USD — usar menor 'ask')">
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="priceModeUsdUsd"
                  value="auto"
                  checked={priceModeUsdUsd === "auto"}
                  onChange={() => setPriceModeUsdUsd("auto")}
                />
                <span>Precio de la API</span>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="priceModeUsdUsd"
                  value="manual"
                  checked={priceModeUsdUsd === "manual"}
                  onChange={() => setPriceModeUsdUsd("manual")}
                />
                <span>Manual (ask)</span>
              </label>
              <input
                type="number"
                step="0.000001"
                placeholder="Precio USDT/USD (ask)"
                className="px-3 py-1 rounded-xl border w-48 disabled:opacity-50
                          bg-white text-slate-900 placeholder-slate-400
                          dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500
                          border-slate-300 dark:border-slate-600
                          focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700"
                value={manualUsdUsd}
                onChange={(e) => setManualUsdUsd(e.target.value)}
                disabled={priceModeUsdUsd !== "manual"}
              />
            </div>

            <div className="flex items-center gap-4 ml-auto">
              <button onClick={() => toggleAll("usdUsd", true)} className="px-3 py-1 rounded-xl border">Marcar todo</button>
              <button onClick={() => toggleAll("usdUsd", false)} className="px-3 py-1 rounded-xl border">Desmarcar todo</button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {usdtUsdAllowed.map((ex) => (
              <label key={ex} className="flex items-center gap-2 p-2 rounded-xl border bg-white dark:bg-slate-800">
                <input
                  type="checkbox"
                  checked={!!selectedUsdUsd[ex]}
                  onChange={() => handleToggle("usdUsd", ex)}
                />
                <span className="capitalize">{ex}</span>
              </label>
            ))}
          </div>
        </Section>

        {/* USDT/ARS — con compra/venta y manual */}
        <Section title="2) Selección de exchanges (USDT/ARS — elegir compra/venta)">
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">Lado:</span>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="sideUsdArs"
                  value="compra"
                  checked={sideUsdArs === "compra"}
                  onChange={() => setSideUsdArs("compra")}
                />
                <span>Compra (ask)</span>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="sideUsdArs"
                  value="venta"
                  checked={sideUsdArs === "venta"}
                  onChange={() => setSideUsdArs("venta")}
                />
                <span>Venta (bid)</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="priceModeUsdArs"
                  value="auto"
                  checked={priceModeUsdArs === "auto"}
                  onChange={() => setPriceModeUsdArs("auto")}
                />
                <span>Precio de la API</span>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="priceModeUsdArs"
                  value="manual"
                  checked={priceModeUsdArs === "manual"}
                  onChange={() => setPriceModeUsdArs("manual")}
                />
                <span>Manual</span>
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Precio USDT/ARS"
                className="px-3 py-1 rounded-xl border w-44 disabled:opacity-50
                            bg-white text-slate-900 placeholder-slate-400
                            dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500
                            border-slate-300 dark:border-slate-600
                            focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700"
                value={manualUsdArs}
                onChange={(e) => setManualUsdArs(e.target.value)}
                disabled={priceModeUsdArs !== "manual"}
              />
            </div>

            <div className="flex items-center gap-4 ml-auto">
              <button onClick={() => toggleAll("usdArs", true)} className="px-3 py-1 rounded-xl border">Marcar todo</button>
              <button onClick={() => toggleAll("usdArs", false)} className="px-3 py-1 rounded-xl border">Desmarcar todo</button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {usdtArsAllowed.map((ex) => (
              <label key={ex} className="flex items-center gap-2 p-2 rounded-xl border bg-white dark:bg-slate-800">
                <input
                  type="checkbox"
                  checked={!!selectedUsdArs[ex]}
                  onChange={() => handleToggle("usdArs", ex)}
                />
                <span className="capitalize">{ex}</span>
              </label>
            ))}
          </div>
        </Section>

        {/* Cotización USD final */}
        <Section title="3) Cotización para compra de USD (elegí fuente)">
          <div className="grid gap-3">
            <label className="flex items-center gap-2 p-3 rounded-xl border bg-white dark:bg-slate-800">
              <input
                type="radio"
                name="rateMode"
                value="api"
                checked={rateMode === "api"}
                onChange={() => setRateMode("api")}
              />
              <span>Usar DolarAPI — <em>oficial</em></span>
              {dolarOficial && (
                <Pill>venta: {Number(dolarOficial.venta).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Pill>
              )}
            </label>

            <label className="flex flex-col gap-2 p-3 rounded-xl border bg-white dark:bg-slate-800">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="rateMode"
                  value="manual"
                  checked={rateMode === "manual"}
                  onChange={() => setRateMode("manual")}
                />
                <span>Usar valor manual</span>
              </span>
              <div className="flex items-center gap-2 pl-6">
                <span className="text-sm opacity-75 w-40">ARS por USD (venta)</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej: 1450.00"
                  className="px-3 py-1 rounded-xl border w-40
                              bg-white text-slate-900 placeholder-slate-400
                              dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500
                              border-slate-300 dark:border-slate-600
                              focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700"
                  value={manualVenta}
                  onChange={(e) => setManualVenta(e.target.value)}
                  disabled={rateMode !== "manual"}
                />
              </div>
            </label>
          </div>
        </Section>

        {/* Calcular */}
        <Section title="4) Calcular ciclo de arbitraje">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              onClick={fetchAll}
              disabled={loading}
              className="px-4 py-2 rounded-2xl shadow bg-white dark:bg-slate-800 border hover:shadow-md disabled:opacity-60"
            >
              {loading ? "Calculando..." : "Calcular ahora"}
            </button>
            <div className="text-sm opacity-75">
              Consulta CriptoYa (USDT/USD, USDT/ARS) + {rateMode === "api" ? "DolarAPI oficial (venta)" : "valor manual (venta)"}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl border bg-red-50 text-red-700 dark:bg-red-900/30 dark:border-red-800">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 grid gap-3">
              <div className="p-4 rounded-2xl border bg-white dark:bg-slate-800">
                <h3 className="font-semibold mb-2">Paso 1: Compra de USDT con USD</h3>
                <p className="text-sm">Exchange: <strong>{result.step1?.exchange}</strong> — ask: <strong>{result.step1?.ask?.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</strong> (USDT/USD)</p>
                <p className="text-sm">USDT obtenidos desde 1 USD: <strong>{result.step1?.usdtObtained?.toLocaleString("es-AR", { minimumFractionDigits: 6, maximumFractionDigits: 6 })}</strong></p>
              </div>

              <div className="p-4 rounded-2xl border bg-white dark:bg-slate-800">
                <h3 className="font-semibold mb-2">Paso 2: USDT ↔ ARS</h3>
                <p className="text-sm">
                  Lado: <strong>{result.step2?.side === "venta" ? "Venta (bid)" : "Compra (ask)"}</strong> — Exchange: <strong>{result.step2?.exchange}</strong> — precio: <strong>{result.step2?.price?.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> (ARS/USDT)
                </p>
                <p className="text-sm">ARS obtenidos: <strong>{result.step2?.arsObtained?.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
              </div>

              <div className="p-4 rounded-2xl border bg-white dark:bg-slate-800">
                <h3 className="font-semibold mb-2">Paso 3: Compra de USD con ARS</h3>
                <div className="flex items-center gap-2 mb-1">
                  <Pill>Fuente: {result.step3?.nombre}</Pill>
                </div>
                <p className="text-sm">Cotización — venta: <strong>{result.step3?.venta?.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> (ARS/USD)</p>
                <p className="text-sm">USD finales: <strong>{result.step3?.usdFinal?.toLocaleString("es-AR", { minimumFractionDigits: 6, maximumFractionDigits: 6 })}</strong></p>
              </div>

              <div className="p-4 rounded-2xl border bg-white dark:bg-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-sm">Fecha de consulta (America/Argentina/Buenos_Aires):</div>
                  <div className="font-semibold">{result.timestamp}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">Ganancia total</div>
                  <div className={`text-2xl font-bold ${result.profitPct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {result.profitPct.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                  </div>
                </div>
              </div>

              
            </div>
          )}
        </Section>

        <footer className="pt-2 text-xs opacity-70">
          Nota: Este demo no contempla comisiones, límites, tiempos de acreditación ni riesgos de contraparte. Verifica CEX/P2P/PSP, compliance y límites de on/off-ramp antes de operar.
        </footer>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Arbitraje />);
