// Tomamos hooks desde el objeto global React (sin imports)
const { useMemo, useState } = React;

// Web app: USD -> USDT -> ARS -> USD arbitrage checker using
// - CriptoYa USDT/USD (min ask)
// - CriptoYa USDT/ARS (max bid)
// - DolarAPI oficial (venta)
//
// Requisitos del usuario:
// 1) Compra de USDT con USD: https://criptoya.com/api/USDT/USD/0.1
//    - usar menor valor "ask"
//    - filtrar por exchanges seleccionados via checkboxes
// 2) Venta de USDT por ARS: https://criptoya.com/api/USDT/ARS/0.1
//    - usar mayor valor "bid"
//    - filtrar por exchanges seleccionados via checkboxes
// 3) Compra de USD con ARS: https://dolarapi.com/v1/dolares/oficial
//    - usar valor "venta" (y mostrar también "nombre")
// 4) Monto inicial fijo: 1 USD
// 5) Devolver detalle paso a paso + % de ganancia y fecha de consulta

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
    <div className="bg-white/70 backdrop-blur rounded-2xl shadow p-5 border border-slate-200">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="inline-block text-xs px-2 py-1 rounded-full border border-slate-300 mr-2 mb-2">
      {children}
    </span>
  );
}

function Arbitraje() {
  const [selectedUsdUsd, setSelectedUsdUsd] = useState(() => {
    const init = {};
    usdtUsdAllowed.forEach((k) => (init[k] = true));
    return init; // por defecto: todos seleccionados
  });

  const [selectedUsdArs, setSelectedUsdArs] = useState(() => {
    const init = {};
    usdtArsAllowed.forEach((k) => (init[k] = true));
    return init; // por defecto: todos seleccionados
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Datos crudos
  const [usdtUsdData, setUsdtUsdData] = useState(null);
  const [usdtArsData, setUsdtArsData] = useState(null);
  const [dolarOficial, setDolarOficial] = useState(null);

  // Resultado del ciclo
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
      const [r1, r2, r3] = await Promise.all([
        fetch("https://criptoya.com/api/USDT/USD/0.1"),
        fetch("https://criptoya.com/api/USDT/ARS/0.1"),
        fetch("https://dolarapi.com/v1/dolares/oficial"),
      ]);

      if (!r1.ok) throw new Error("Error al consultar USDT/USD en CriptoYa");
      if (!r2.ok) throw new Error("Error al consultar USDT/ARS en CriptoYa");
      if (!r3.ok) throw new Error("Error al consultar DolarAPI oficial");

      const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
      setUsdtUsdData(d1);
      setUsdtArsData(d2);
      setDolarOficial(d3);

      // Paso 1: elegir min ask en USDT/USD entre seleccionados
      const step1Candidates = Object.entries(d1)
        .filter(([ex, obj]) => selectedUsdUsd[ex] && obj && typeof obj.ask === "number")
        .map(([ex, obj]) => ({ exchange: ex, ask: obj.ask }));

      if (!step1Candidates.length) throw new Error("No hay exchanges seleccionados con 'ask' válido para USDT/USD");

      const bestAsk = step1Candidates.reduce((min, cur) => (cur.ask < min.ask ? cur : min));
      const usdtObtained = 1 / bestAsk.ask; // 1 USD -> USDT

      // Paso 2: elegir max bid en USDT/ARS entre seleccionados
      const step2Candidates = Object.entries(d2)
        .filter(([ex, obj]) => selectedUsdArs[ex] && obj && typeof obj.bid === "number")
        .map(([ex, obj]) => ({ exchange: ex, bid: obj.bid }));

      if (!step2Candidates.length) throw new Error("No hay exchanges seleccionados con 'bid' válido para USDT/ARS");

      const bestBid = step2Candidates.reduce((max, cur) => (cur.bid > max.bid ? cur : max));
      const arsObtained = usdtObtained * bestBid.bid; // vender USDT -> ARS

      // Paso 3: comprar USD oficial con ARS (venta)
      const nombre = d3?.nombre ?? "oficial";
      const venta = Number(d3?.venta);
      if (!venta || isNaN(venta)) throw new Error("DolarAPI: 'venta' inválido");
      const usdFinal = arsObtained / venta; // ARS -> USD

      const profitPct = ((usdFinal - 1) / 1) * 100;

      const timestamp = new Intl.DateTimeFormat("es-AR", {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date());

      setResult({
        step1: { exchange: bestAsk.exchange, ask: bestAsk.ask, usdtObtained },
        step2: { exchange: bestBid.exchange, bid: bestBid.bid, arsObtained },
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 text-slate-900 p-6">
      <div className="max-w-5xl mx-auto grid gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Arbitraje USD → USDT → ARS → USD</h1>
          <div className="text-sm opacity-80">Monto inicial: <strong>1 USD</strong></div>
        </header>

        <Section title="1) Selección de exchanges (USDT/USD – usar menor 'ask')">
          <div className="flex items-center gap-4 mb-3">
            <button onClick={() => toggleAll("usdUsd", true)} className="px-3 py-1 rounded-xl border">Marcar todo</button>
            <button onClick={() => toggleAll("usdUsd", false)} className="px-3 py-1 rounded-xl border">Desmarcar todo</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {usdtUsdAllowed.map((ex) => (
              <label key={ex} className="flex items-center gap-2 p-2 rounded-xl border bg-white">
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

        <Section title="2) Selección de exchanges (USDT/ARS – usar mayor 'bid')">
          <div className="flex items-center gap-4 mb-3">
            <button onClick={() => toggleAll("usdArs", true)} className="px-3 py-1 rounded-xl border">Marcar todo</button>
            <button onClick={() => toggleAll("usdArs", false)} className="px-3 py-1 rounded-xl border">Desmarcar todo</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {usdtArsAllowed.map((ex) => (
              <label key={ex} className="flex items-center gap-2 p-2 rounded-xl border bg-white">
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

        <Section title="3) Calcular ciclo de arbitraje">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              onClick={fetchAll}
              disabled={loading}
              className="px-4 py-2 rounded-2xl shadow bg-white border hover:shadow-md disabled:opacity-60"
            >
              {loading ? "Calculando..." : "Calcular ahora"}
            </button>
            <div className="text-sm opacity-75">Consulta CriptoYa (USDT/USD, USDT/ARS) + DolarAPI oficial (venta)</div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl border bg-red-50 text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 grid gap-3">
              <div className="p-4 rounded-2xl border bg-white">
                <h3 className="font-semibold mb-2">Paso 1: Compra de USDT con USD</h3>
                <p className="text-sm">Exchange: <strong>{result.step1?.exchange}</strong> — ask: <strong>{result.step1?.ask?.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</strong> (USDT/USD)</p>
                <p className="text-sm">USDT obtenidos desde 1 USD: <strong>{result.step1?.usdtObtained?.toLocaleString("es-AR", { minimumFractionDigits: 6, maximumFractionDigits: 6 })}</strong></p>
              </div>

              <div className="p-4 rounded-2xl border bg-white">
                <h3 className="font-semibold mb-2">Paso 2: Venta de USDT por ARS</h3>
                <p className="text-sm">Exchange: <strong>{result.step2?.exchange}</strong> — bid: <strong>{result.step2?.bid?.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> (ARS/USDT)</p>
                <p className="text-sm">ARS obtenidos: <strong>{result.step2?.arsObtained?.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
              </div>

              <div className="p-4 rounded-2xl border bg-white">
                <h3 className="font-semibold mb-2">Paso 3: Compra de USD con ARS (Dólar oficial)</h3>
                <p className="text-sm">Cotización: <strong>{result.step3?.nombre}</strong> — venta: <strong>{result.step3?.venta?.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> (ARS/USD)</p>
                <p className="text-sm">USD finales: <strong>{result.step3?.usdFinal?.toLocaleString("es-AR", { minimumFractionDigits: 6, maximumFractionDigits: 6 })}</strong></p>
              </div>

              <div className="p-4 rounded-2xl border bg-white flex items-center justify-between">
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

              <div className="p-4 rounded-2xl border bg-white">
                <h3 className="font-semibold mb-2">Datos crudos (depuración rápida)</h3>
                <div className="text-xs max-h-72 overflow-auto whitespace-pre-wrap break-all">
                  <p className="mb-2"><strong>USDT/USD (CriptoYa):</strong> {usdtUsdData ? JSON.stringify(usdtUsdData) : "—"}</p>
                  <p className="mb-2"><strong>USDT/ARS (CriptoYa):</strong> {usdtArsData ? JSON.stringify(usdtArsData) : "—"}</p>
                  <p className="mb-2"><strong>DolarAPI oficial:</strong> {dolarOficial ? JSON.stringify(dolarOficial) : "—"}</p>
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
