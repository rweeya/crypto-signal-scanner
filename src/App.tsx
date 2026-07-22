import { useState, useCallback, useRef, useEffect } from 'react';

const SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT',
  'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT', 'LTC/USDT', 'UNI/USDT', 'ATOM/USDT',
  'ETC/USDT', 'FIL/USDT', 'APT/USDT', 'ARB/USDT', 'OP/USDT', 'SUI/USDT', 'NEAR/USDT',
  'INJ/USDT', 'IMX/USDT', 'HBAR/USDT', 'VET/USDT', 'GRT/USDT', 'RNDR/USDT', 'MKR/USDT',
  'AAVE/USDT', 'ALGO/USDT', 'FTM/USDT', 'SAND/USDT', 'MANA/USDT', 'GALA/USDT', 'AXS/USDT',
  'CHZ/USDT', 'EOS/USDT', 'ZEC/USDT', 'COMP/USDT', 'ICP/USDT', 'STX/USDT', 'KAS/USDT',
  'RUNE/USDT', 'EGLD/USDT', 'FLOW/USDT', 'PEPE/USDT', 'WIF/USDT', 'BONK/USDT', 'SHIB/USDT',
  'SEI/USDT', 'WLD/USDT', 'TIA/USDT', 'JUP/USDT', 'PYTH/USDT', 'ENA/USDT', 'FET/USDT',
  'BEAM/USDT', 'BLUR/USDT', 'ORDI/USDT', 'PENDLE/USDT', 'ENS/USDT', 'LDO/USDT',
  'TON/USDT', 'NOT/USDT', 'MEW/USDT', 'POPCAT/USDT', 'RAY/USDT', 'JTO/USDT',
  'TRX/USDT', 'XLM/USDT', 'XTZ/USDT', 'CAKE/USDT', '1INCH/USDT', 'SNX/USDT', 'CRV/USDT',
  'ZRO/USDT', 'ZK/USDT', 'ALT/USDT', 'PORTAL/USDT', 'AI/USDT', 'BOME/USDT',
  'TURBO/USDT', 'MEME/USDT', 'BANANA/USDT', 'RARE/USDT', 'BB/USDT', 'IO/USDT',
  'PIXEL/USDT', 'SAGA/USDT', 'DYM/USDT', 'OMNI/USDT', 'REZ/USDT', 'ETHFI/USDT',
  'STRK/USDT', 'GMX/USDT', 'LRC/USDT', 'SUPER/USDT', 'MINA/USDT', 'YGG/USDT',
  'CKB/USDT', 'SUSHI/USDT', 'THETA/USDT', 'APE/USDT', 'BAL/USDT', 'ENJ/USDT',
  'HOT/USDT', 'JASMY/USDT', 'KDA/USDT', 'MAGIC/USDT', 'OCEAN/USDT', 'QNT/USDT',
  'RVN/USDT', 'SKL/USDT', 'STORJ/USDT', 'UMA/USDT', 'WOO/USDT', 'ZIL/USDT',
  'ZRX/USDT', 'ANKR/USDT', 'ASTR/USDT', 'BAND/USDT', 'CELR/USDT', 'DENT/USDT',
  'DYDX/USDT', 'GLMR/USDT', 'ICX/USDT', 'IOST/USDT', 'IOTX/USDT', 'JOE/USDT',
  'KNC/USDT', 'LINA/USDT', 'LPT/USDT', 'MOVR/USDT', 'NKN/USDT', 'OGN/USDT',
  'OM/USDT', 'ONT/USDT', 'PERP/USDT', 'POWR/USDT', 'REN/USDT', 'ROSE/USDT',
  'SFP/USDT', 'SPELL/USDT', 'SSV/USDT', 'SXP/USDT', 'TRB/USDT', 'TRU/USDT',
  'VRA/USDT', 'WAXP/USDT'
];

interface Signal {
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number;
  strength: 1 | 2 | 3;
  probability: number;
  rsi: number;
  stoch: number;
  adx: number;
  macd: number;
  ema20: number;
  atr: number;
  tp: number;
  sl: number;
}

interface ScanResult {
  time: string;
  total: number;
  signals: number;
  buyCount: number;
  sellCount: number;
}

const calcRSI = (prices: number[], period: number = 14): number => {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  if (losses === 0) return 100;
  return Math.round(100 - 100 / (1 + (gains / period) / (losses / period)));
};

const calcEMA = (prices: number[], period: number): number => {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) ema = (prices[i] - ema) * k + ema;
  return ema;
};

const calcMACD = (prices: number[]): number => {
  if (prices.length < 35) return 0;
  return parseFloat((calcEMA(prices, 12) - calcEMA(prices, 26)).toFixed(4));
};

const calcADX = (prices: number[], period: number = 14): number => {
  if (prices.length < period * 2) return 0;
  const tr: number[] = [], plusDM: number[] = [], minusDM: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const h = Math.max(prices[i], prices[i - 1]), l = Math.min(prices[i], prices[i - 1]);
    const pH = Math.max(prices[i - 1], prices[i - 2] || prices[i - 1]);
    const pL = Math.min(prices[i - 1], prices[i - 2] || prices[i - 1]);
    tr.push(Math.max(h - l, Math.abs(h - prices[i - 1]), Math.abs(l - prices[i - 1])));
    plusDM.push(h - pH > 0 && h - pH > pL - l ? h - pH : 0);
    minusDM.push(pL - l > 0 && pL - l > h - pH ? pL - l : 0);
  }
  const smooth = (d: number[]) => { const k = 2 / (period + 1); let e = d[0]; for (let i = 1; i < d.length; i++) e = d[i] * k + e * (1 - k); return e; };
  const atrVal = smooth(tr);
  if (!atrVal) return 0;
  return Math.abs(smooth(plusDM) - smooth(minusDM)) / (smooth(plusDM) + smooth(minusDM)) * 100;
};

const calcStochastic = (prices: number[], period: number = 14): number => {
  if (prices.length < period) return 50;
  const slice = prices.slice(-period);
  const h = Math.max(...slice), l = Math.min(...slice);
  if (h === l) return 50;
  return ((prices[prices.length - 1] - l) / (h - l)) * 100;
};

const calcATR = (prices: number[], period: number = 14): number => {
  if (!prices || prices.length < period + 1) return 0;
  const tr: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    tr.push(Math.abs(prices[i] - prices[i - 1]));
  }
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
  }
  return atr;
};

const App = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [minProbability, setMinProbability] = useState(40);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);
  const [scanCount, setScanCount] = useState(0);
  const [marketMood, setMarketMood] = useState({ buyPct: 50, sellPct: 50 });
  const [attemptInfo, setAttemptInfo] = useState('');
  const priceCache = useRef<Map<string, number[]>>(new Map());

  const formatPrice = (p: number) => p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(4) : p.toFixed(6);

  const openBybit = (symbol: string) => {
    const base = symbol.split('/')[0];
    window.open(`https://www.bybit.com/trade/spot/${base}/USDT`, '_blank');
  };

  const scan = useCallback(async () => {
    setScanning(true);
    const newSignals: Signal[] = [];

    try {
      const [priceRes, volumeRes] = await Promise.all([
        fetch('https://api.mexc.com/api/v3/ticker/price'),
        fetch('https://api.mexc.com/api/v3/ticker/24hr')
      ]);
      
      const allPrices = await priceRes.json();
      const volumeData = await volumeRes.json();

      const topByVolume = new Set(
        volumeData
          .filter((t: any) => t.symbol.endsWith('USDT'))
          .sort((a: any, b: any) => parseFloat(b.volume) - parseFloat(a.volume))
          .slice(0, 100)
          .map((t: any) => t.symbol)
      );

      let scannedCount = 0;

      for (const sym of SYMBOLS) {
        const mexcSym = sym.replace('/', '');
        if (!topByVolume.has(mexcSym)) continue;

        const ticker = allPrices.find((t: any) => t.symbol === mexcSym);
        if (!ticker) continue;

        const price = parseFloat(ticker.price);
        if (!price) continue;

        let history = priceCache.current.get(sym) || [];
        history.push(price);
        if (history.length > 200) history = history.slice(-200);
        priceCache.current.set(sym, history);

        if (history.length < 50) continue;

        const rsi = calcRSI(history);
        const stoch = calcStochastic(history);
        const adx = calcADX(history);
        const macd = calcMACD(history);
        const ema20 = calcEMA(history, 20);
        const atr = calcATR(history);

        if (atr / price < 0.001) continue;

        scannedCount++;

        if (rsi < 45 && stoch < 35 && macd > 0 && price > ema20 && adx > 18) {
          const strength: 1 | 2 | 3 = rsi < 28 && stoch < 18 ? 3 : rsi < 35 ? 2 : 1;
          newSignals.push({
            symbol: sym, action: 'BUY', price, strength, probability: strength === 3 ? 75 : strength === 2 ? 60 : 45,
            rsi, stoch: Math.round(stoch), adx: Math.round(adx), macd, ema20, atr,
            tp: price * 1.01, sl: price * 0.997
          });
        } else if (rsi > 55 && stoch > 65 && macd < 0 && price < ema20 && adx > 18) {
          const strength: 1 | 2 | 3 = rsi > 72 && stoch > 82 ? 3 : rsi > 65 ? 2 : 1;
          newSignals.push({
            symbol: sym, action: 'SELL', price, strength, probability: strength === 3 ? 75 : strength === 2 ? 60 : 45,
            rsi, stoch: Math.round(stoch), adx: Math.round(adx), macd, ema20, atr,
            tp: price * 0.99, sl: price * 1.003
          });
        }
      }

      const sorted = newSignals.sort((a, b) => b.probability - a.probability);
      const buyCount = sorted.filter(s => s.action === 'BUY').length;
      const sellCount = sorted.filter(s => s.action === 'SELL').length;
      const total = buyCount + sellCount || 1;

      setMarketMood({ buyPct: Math.round((buyCount / total) * 100), sellPct: Math.round((sellCount / total) * 100) });
      setTotalScanned(scannedCount);
      setSignals(sorted);
      setScanCount(prev => prev + 1);

      setScanHistory(prev => [{ time: new Date().toLocaleTimeString(), total: scannedCount, signals: sorted.length, buyCount, sellCount }, ...prev].slice(0, 20));
    } catch (e) {
      console.error('Ошибка:', e);
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    scan();
    const interval = setInterval(scan, 60000);
    return () => clearInterval(interval);
  }, [scan]);

  const filteredSignals = signals.filter(s => filter === 'ALL' || s.action === filter).filter(s => s.probability >= minProbability);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white">
      <header className="border-b border-purple-500/20 bg-black/80 backdrop-blur sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">🤖 CRYPTO SIGNAL SCANNER</h1>
              <p className="text-xs text-gray-500 mt-1">{SYMBOLS.length} активов | MEXC API | Авто-сканирование</p>
            </div>
            <div className="flex items-center gap-3">
              {scanning && <span className="text-sm text-purple-400 animate-pulse">⏳ Сканирую...</span>}
              <button onClick={scan} disabled={scanning} className={`px-6 py-2.5 rounded-xl font-bold text-sm ${scanning ? 'bg-gray-700' : 'bg-purple-600 hover:bg-purple-500'}`}>
                {scanning ? '...' : '🔄 Обновить'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {scanCount > 0 && (
          <>
            <div className="bg-black/40 rounded-xl p-4 border border-purple-500/20 mb-6">
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1"><span className="text-green-400">BUY {marketMood.buyPct}%</span><span className="text-red-400">SELL {marketMood.sellPct}%</span></div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-500" style={{ width: `${marketMood.buyPct}%` }} />
                    <div className="h-full bg-red-500" style={{ width: `${marketMood.sellPct}%` }} />
                  </div>
                </div>
                <div className="text-center"><div className="text-2xl font-bold">{filteredSignals.length}</div><div className="text-xs text-gray-500">сигналов</div></div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
              <div className="flex gap-1 bg-black/40 rounded-lg p-1">
                {(['ALL', 'BUY', 'SELL'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-md text-sm ${filter === f ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>{f === 'ALL' ? 'Все' : f}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSignals.map((s, i) => (
                <div key={i} onClick={() => openBybit(s.symbol)} className={`rounded-xl p-4 border cursor-pointer hover:scale-[1.02] transition-all ${s.action === 'BUY' ? 'bg-gradient-to-br from-green-950/30 to-black border-green-500/30' : 'bg-gradient-to-br from-red-950/30 to-black border-red-500/30'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div><span className="font-bold text-lg">{s.symbol}</span><span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${s.action === 'BUY' ? 'bg-green-600' : 'bg-red-600'}`}>{s.action}</span></div>
                    <div className="text-right"><div className={`text-lg font-bold ${s.probability >= 60 ? 'text-green-400' : 'text-yellow-400'}`}>{s.probability}%</div></div>
                  </div>
                  <div className="text-2xl font-bold mb-3">${formatPrice(s.price)}</div>
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div className="bg-black/40 rounded p-2"><div className="text-gray-500">TP (+1%)</div><div className="text-green-400 font-bold">${formatPrice(s.tp)}</div></div>
                    <div className="bg-black/40 rounded p-2"><div className="text-gray-500">SL (-0.3%)</div><div className="text-red-400 font-bold">${formatPrice(s.sl)}</div></div>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-[10px]">
                    <div className="bg-black/30 rounded p-1.5 text-center"><div className="text-gray-500">RSI</div><div className={s.rsi < 30 ? 'text-green-400' : s.rsi > 70 ? 'text-red-400' : 'text-white'}>{s.rsi}</div></div>
                    <div className="bg-black/30 rounded p-1.5 text-center"><div className="text-gray-500">STOCH</div><div className={s.stoch < 20 ? 'text-green-400' : s.stoch > 80 ? 'text-red-400' : 'text-white'}>{s.stoch}</div></div>
                    <div className="bg-black/30 rounded p-1.5 text-center"><div className="text-gray-500">ADX</div><div className="text-white">{s.adx}</div></div>
                    <div className="bg-black/30 rounded p-1.5 text-center"><div className="text-gray-500">MACD</div><div className={s.macd > 0 ? 'text-green-400' : 'text-red-400'}>{s.macd.toFixed(4)}</div></div>
                    <div className="bg-black/30 rounded p-1.5 text-center"><div className="text-gray-500">ATR</div><div className="text-white">{s.atr.toFixed(4)}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
