import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// TYPES
// ============================================
type SignalDirection = 'BUY' | 'SELL' | 'NEUTRAL';

interface IndicatorValues {
  rsi: number;
  stochastic: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  adx: number;
  ema20: number;
  ema50: number;
}

interface Signal {
  symbol: string;
  direction: SignalDirection;
  price: number;
  strength: number;
  indicators: IndicatorValues;
  tp: number;
  sl: number;
  timestamp: number;
}

interface ScanHistory {
  timestamp: number;
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
}

// ============================================
// INDICATOR CALCULATIONS
// ============================================
const calculateRSI = (prices: number[], period: number = 14): number => {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

const calculateStochastic = (prices: number[], period: number = 14): number => {
  if (prices.length < period) return 50;
  const recent = prices.slice(-period);
  const low = Math.min(...recent);
  const high = Math.max(...recent);
  const current = prices[prices.length - 1];
  if (high === low) return 50;
  return ((current - low) / (high - low)) * 100;
};

const calculateEMA = (prices: number[], period: number): number => {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
};

const calculateMACD = (prices: number[]): { macd: number; signal: number; histogram: number } => {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  const macdValues = prices.slice(26).map((_, i) => {
    const p = prices.slice(0, 26 + i);
    return calculateEMA(p, 12) - calculateEMA(p, 26);
  });
  const signal = calculateEMA(macdValues, 9);
  return { macd, signal, histogram: macd - signal };
};

const calculateADX = (prices: number[], period: number = 14): number => {
  if (prices.length < period + 1) return 25;
  const trs = [];
  const plusDM = [];
  const minusDM = [];
  
  for (let i = 1; i < prices.length; i++) {
    const high = prices[i];
    const low = prices[i];
    const prevHigh = prices[i-1];
    const prevLow = prices[i-1];
    
    const tr = Math.max(high - low, Math.abs(high - prevHigh), Math.abs(low - prevLow));
    trs.push(tr);
    
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  
  if (trs.length < period) return 25;
  
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let plusDI = plusDM.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let minusDI = minusDM.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    plusDI = (plusDI * (period - 1) + plusDM[i]) / period;
    minusDI = (minusDI * (period - 1) + minusDM[i]) / period;
  }
  
  const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
  return dx;
};

// ============================================
// SIGNAL GENERATION
// ============================================
const generateSignal = (symbol: string, prices: number[]): Signal | null => {
  if (prices.length < 50) return null;
  
  const rsi = calculateRSI(prices);
  const stochastic = calculateStochastic(prices);
  const macdData = calculateMACD(prices);
  const adx = calculateADX(prices);
  const ema20 = calculateEMA(prices, 20);
  const ema50 = calculateEMA(prices, 50);
  const price = prices[prices.length - 1];
  
  const indicators: IndicatorValues = {
    rsi,
    stochastic,
    macd: macdData.macd,
    macdSignal: macdData.signal,
    macdHistogram: macdData.histogram,
    adx,
    ema20,
    ema50
  };
  
  let buyScore = 0;
  let sellScore = 0;
  
  if (rsi < 30) buyScore += 2;
  else if (rsi > 70) sellScore += 2;
  else if (rsi < 50) buyScore += 1;
  else if (rsi > 50) sellScore += 1;
  
  if (stochastic < 20) buyScore += 2;
  else if (stochastic > 80) sellScore += 2;
  else if (stochastic < 50) buyScore += 1;
  else if (stochastic > 50) sellScore += 1;
  
  if (macdData.histogram > 0 && macdData.macd > macdData.signal) buyScore += 2;
  else if (macdData.histogram < 0 && macdData.macd < macdData.signal) sellScore += 2;
  else if (macdData.macd > macdData.signal) buyScore += 1;
  else if (macdData.macd < macdData.signal) sellScore += 1;
  
  if (adx > 25) {
    if (ema20 > ema50) buyScore += 1;
    else if (ema20 < ema50) sellScore += 1;
  }
  
  if (ema20 > ema50) buyScore += 1;
  else if (ema20 < ema50) sellScore += 1;
  
  let direction: SignalDirection = 'NEUTRAL';
  let strength = 0;
  
  if (buyScore > sellScore && buyScore >= 3) {
    direction = 'BUY';
    strength = Math.min(Math.floor(buyScore / 1.5), 5);
  } else if (sellScore > buyScore && sellScore >= 3) {
    direction = 'SELL';
    strength = Math.min(Math.floor(sellScore / 1.5), 5);
  }
  
  if (direction === 'NEUTRAL' || strength < 2) return null;
  
  const tp = direction === 'BUY' ? price * 1.01 : price * 0.99;
  const sl = direction === 'BUY' ? price * 0.997 : price * 1.003;
  
  return {
    symbol,
    direction,
    price,
    strength,
    indicators,
    tp,
    sl,
    timestamp: Date.now()
  };
};

// ============================================
// BINANCE API
// ============================================
const fetchBinancePrices = async (): Promise<{ symbol: string; price: number; prices: number[] }[]> => {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const data = await response.json();
    
    const usdtPairs = data
      .filter((item: any) => item.symbol.endsWith('USDT'))
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 150);
    
    const results = await Promise.all(
      usdtPairs.map(async (item: any) => {
        try {
          const klinesResponse = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${item.symbol}&interval=1h&limit=100`
          );
          const klinesData = await klinesResponse.json();
          const prices = klinesData.map((k: any) => parseFloat(k[4]));
          
          return {
            symbol: item.symbol,
            price: parseFloat(item.lastPrice),
            prices
          };
        } catch (e) {
          return null;
        }
      })
    );
    
    return results.filter((r): r is { symbol: string; price: number; prices: number[] } => r !== null);
  } catch (error) {
    console.error('Error fetching from Binance:', error);
    return [];
  }
};

// ============================================
// MAIN APP
// ============================================
const App: React.FC = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [minStrength, setMinStrength] = useState(2);
  const [lastScanTime, setLastScanTime] = useState<number | null>(null);
  
  useEffect(() => {
    const saved = localStorage.getItem('scanHistory');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);
  
  useEffect(() => {
    localStorage.setItem('scanHistory', JSON.stringify(history.slice(-20)));
  }, [history]);
  
  const scanMarket = useCallback(async () => {
    setIsScanning(true);
    try {
      const data = await fetchBinancePrices();
      const newSignals: Signal[] = [];
      let buyCount = 0;
      let sellCount = 0;
      
      for (const item of data) {
        const signal = generateSignal(item.symbol, item.prices);
        if (signal) {
          newSignals.push(signal);
          if (signal.direction === 'BUY') buyCount++;
          else if (signal.direction === 'SELL') sellCount++;
        }
      }
      
      setSignals(newSignals);
      setLastScanTime(Date.now());
      
      setHistory(prev => [...prev, {
        timestamp: Date.now(),
        totalSignals: newSignals.length,
        buySignals: buyCount,
        sellSignals: sellCount
      }]);
      
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  }, []);
  
  const filteredSignals = signals.filter(s => {
    if (filterDirection !== 'ALL' && s.direction !== filterDirection) return false;
    if (s.strength < minStrength) return false;
    return true;
  });
  
  const getStarRating = (strength: number) => {
    return '★'.repeat(strength) + '☆'.repeat(5 - strength);
  };
  
  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };
  
  return (
    <div className="min-h-screen bg-black text-white font-mono p-4 md:p-8">
      <div className="fixed inset-0 bg-gradient-to-b from-red-900/5 via-black to-black pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-red-800 bg-clip-text text-transparent">
              ⚡ CYBER SCAN
            </h1>
            <p className="text-gray-400 text-sm">Crypto Signal Scanner v2.0</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={scanMarket}
              disabled={isScanning}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-900/50 rounded-lg font-bold transition-all flex items-center gap-2 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
            >
              {isScanning ? (
                <>
                  <span className="animate-spin">⚡</span>
                  SCANNING...
                </>
              ) : (
                '🔍 SCAN MARKET'
              )}
            </button>
            
            {lastScanTime && (
              <span className="text-gray-500 text-sm self-center">
                Last scan: {new Date(lastScanTime).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-red-950/30 border border-red-800/30 rounded-lg p-3">
            <div className="text-gray-400 text-xs">TOTAL SIGNALS</div>
            <div className="text-2xl font-bold text-red-400">{signals.length}</div>
          </div>
          <div className="bg-green-950/30 border border-green-800/30 rounded-lg p-3">
            <div className="text-gray-400 text-xs">BUY</div>
            <div className="text-2xl font-bold text-green-400">
              {signals.filter(s => s.direction === 'BUY').length}
            </div>
          </div>
          <div className="bg-red-950/30 border border-red-800/30 rounded-lg p-3">
            <div className="text-gray-400 text-xs">SELL</div>
            <div className="text-2xl font-bold text-red-400">
              {signals.filter(s => s.direction === 'SELL').length}
            </div>
          </div>
          <div className="bg-purple-950/30 border border-purple-800/30 rounded-lg p-3">
            <div className="text-gray-400 text-xs">STRONG SIGNALS (★4+)</div>
            <div className="text-2xl font-bold text-purple-400">
              {signals.filter(s => s.strength >= 4).length}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 mb-6 bg-red-950/10 border border-red-800/20 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Direction:</span>
            <div className="flex gap-1">
              {['ALL', 'BUY', 'SELL'].map(dir => (
                <button
                  key={dir}
                  onClick={() => setFilterDirection(dir as any)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    filterDirection === dir
                      ? dir === 'BUY' ? 'bg-green-600 text-white' :
                        dir === 'SELL' ? 'bg-red-600 text-white' :
                        'bg-gray-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-gray-400 text-sm">Min Strength:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  onClick={() => setMinStrength(s)}
                  className={`px-2 py-1 text-sm rounded transition-colors ${
                    minStrength === s
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredSignals.map((signal, index) => (
              <motion.div
                key={`${signal.symbol}-${signal.timestamp}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                className={`border rounded-lg p-4 ${
                  signal.direction === 'BUY'
                    ? 'bg-green-950/20 border-green-500/30'
                    : 'bg-red-950/20 border-red-500/30'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-lg font-bold">{signal.symbol}</div>
                    <div className={`text-sm font-bold ${
                      signal.direction === 'BUY' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {signal.direction}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Price</div>
                    <div className="font-mono">${formatPrice(signal.price)}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-yellow-400 text-sm">{getStarRating(signal.strength)}</span>
                  <span className="text-gray-500 text-xs">({signal.strength}/5)</span>
                </div>
                
                <div className="grid grid-cols-2 gap-1 text-xs mb-3">
                  <div className="text-gray-400">RSI: <span className="text-white">{signal.indicators.rsi.toFixed(1)}</span></div>
                  <div className="text-gray-400">Stoch: <span className="text-white">{signal.indicators.stochastic.toFixed(1)}</span></div>
                  <div className="text-gray-400">MACD: <span className="text-white">{signal.indicators.macd.toFixed(4)}</span></div>
                  <div className="text-gray-400">ADX: <span className="text-white">{signal.indicators.adx.toFixed(1)}</span></div>
                  <div className="text-gray-400">EMA20: <span className="text-white">{signal.indicators.ema20.toFixed(4)}</span></div>
                  <div className="text-gray-400">EMA50: <span className="text-white">{signal.indicators.ema50.toFixed(4)}</span></div>
                </div>
                
                <div className="flex justify-between text-xs border-t border-gray-800 pt-2">
                  <div>
                    <span className="text-gray-400">TP</span>
                    <span className="text-green-400 ml-1">+1%</span>
                    <span className="text-gray-500 ml-1">${formatPrice(signal.tp)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">SL</span>
                    <span className="text-red-400 ml-1">-0.3%</span>
                    <span className="text-gray-500 ml-1">${formatPrice(signal.sl)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {filteredSignals.length === 0 && signals.length > 0 && (
          <div className="text-center text-gray-500 py-12">
            No signals match your filters
          </div>
        )}
        
        {signals.length === 0 && !isScanning && (
          <div className="text-center text-gray-500 py-20">
            <div className="text-6xl mb-4">📡</div>
            <p>Click "SCAN MARKET" to start scanning</p>
            <p className="text-sm text-gray-600 mt-2">Scanning 150 USDT pairs on Binance</p>
          </div>
        )}
        
        {history.length > 0 && (
          <div className="mt-12 border-t border-red-800/20 pt-6">
            <h2 className="text-xl font-bold text-red-400 mb-4">📊 SCAN HISTORY</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="text-left py-2">Time</th>
                    <th className="text-right py-2">Total</th>
                    <th className="text-right py-2 text-green-400">BUY</th>
                    <th className="text-right py-2 text-red-400">SELL</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(-10).reverse().map((h, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-2 text-gray-300">{new Date(h.timestamp).toLocaleTimeString()}</td>
                      <td className="text-right">{h.totalSignals}</td>
                      <td className="text-right text-green-400">{h.buySignals}</td>
                      <td className="text-right text-red-400">{h.sellSignals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
