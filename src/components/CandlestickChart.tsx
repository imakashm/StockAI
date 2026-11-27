import { useEffect, useMemo, useRef, useState } from 'react';
import type { TechnicalPoint } from '../types/market.ts';
import { formatIndianVolume, formatInr } from '../lib/format.ts';

interface CandlestickChartProps {
  data: TechnicalPoint[];
  showEma20: boolean;
  showEma50: boolean;
  showSma200: boolean;
  showBollinger: boolean;
  showSupportResistance: boolean;
  supportLevels: number[];
  resistanceLevels: number[];
}

export function CandlestickChart({
  data,
  showEma20,
  showEma50,
  showSma200,
  showBollinger,
  showSupportResistance,
  supportLevels,
  resistanceLevels,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(820);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const nextWidth = Math.max(320, Math.floor(el.getBoundingClientRect().width));
      setWidth(nextWidth);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = 340;
  const padTop = 18;
  const padBottom = 30;
  const padLeft = 10;
  const padRight = 68;
  const plotWidth = Math.max(100, width - padLeft - padRight);
  const plotHeight = height - padTop - padBottom;

  const { minPrice, maxPrice, yTicks } = useMemo(() => {
    if (data.length === 0) {
      return { minPrice: 0, maxPrice: 100, yTicks: [0, 50, 100] };
    }
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (const d of data) {
      if (d.low < minVal) minVal = d.low;
      if (d.high > maxVal) maxVal = d.high;
      if (showBollinger && d.bbLower !== null && d.bbLower < minVal) minVal = d.bbLower;
      if (showBollinger && d.bbUpper !== null && d.bbUpper > maxVal) maxVal = d.bbUpper;
      if (showSma200 && d.sma200 !== null) {
        if (d.sma200 < minVal) minVal = d.sma200;
        if (d.sma200 > maxVal) maxVal = d.sma200;
      }
    }

    const padding = Math.max((maxVal - minVal) * 0.06, 1);
    const lo = Math.max(0, minVal - padding);
    const hi = maxVal + padding;
    const step = (hi - lo) / 4;
    const ticks = [0, 1, 2, 3, 4].map((i) => Number((lo + step * i).toFixed(2)));
    return { minPrice: lo, maxPrice: hi, yTicks: ticks };
  }, [data, showBollinger, showSma200]);

  const xForIndex = (i: number) => {
    if (data.length <= 1) return padLeft + plotWidth / 2;
    return padLeft + ((i + 0.5) / data.length) * plotWidth;
  };

  const yForPrice = (price: number) => {
    const ratio = (price - minPrice) / Math.max(maxPrice - minPrice, 0.01);
    return padTop + plotHeight - ratio * plotHeight;
  };

  const buildLinePath = (accessor: (d: TechnicalPoint) => number | null) => {
    let path = '';
    let started = false;
    data.forEach((d, idx) => {
      const val = accessor(d);
      if (val === null) {
        started = false;
        return;
      }
      const x = xForIndex(idx);
      const y = yForPrice(val);
      path += started ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      started = true;
    });
    return path;
  };

  const bollingerAreaPath = useMemo(() => {
    if (!showBollinger) return '';
    const upperPts: string[] = [];
    const lowerPts: string[] = [];
    data.forEach((d, idx) => {
      if (d.bbUpper !== null && d.bbLower !== null) {
        const x = xForIndex(idx).toFixed(1);
        upperPts.push(`${x} ${yForPrice(d.bbUpper).toFixed(1)}`);
        lowerPts.unshift(`${x} ${yForPrice(d.bbLower).toFixed(1)}`);
      }
    });
    if (upperPts.length < 2) return '';
    return `M ${upperPts.join(' L ')} L ${lowerPts.join(' L ')} Z`;
  }, [data, showBollinger, width, minPrice, maxPrice]);

  const candleWidth = Math.max(2, Math.min(11, (plotWidth / Math.max(data.length, 1)) * 0.65));
  const activePoint = hoveredIdx !== null ? data[hoveredIdx] : data[data.length - 1];

  const xTickIndices = useMemo(() => {
    if (data.length === 0) return [];
    const desired = width < 520 ? 4 : 6;
    const step = Math.max(1, Math.floor((data.length - 1) / (desired - 1)));
    const indices: number[] = [];
    for (let i = 0; i < data.length; i += step) {
      indices.push(i);
    }
    if (indices[indices.length - 1] !== data.length - 1) {
      indices.push(data.length - 1);
    }
    return indices;
  }, [data.length, width]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (data.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left - padLeft;
    const idx = Math.floor((relX / plotWidth) * data.length);
    if (idx >= 0 && idx < data.length) {
      setHoveredIdx(idx);
    }
  };

  return (
    <div ref={containerRef} className="w-full select-none">
      {/* Inline OHLC Legend Strip */}
      {activePoint && (
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-mono tabular-nums text-slate-400">
          <span className="text-slate-200 font-medium">{activePoint.date}</span>
          <span>
            O <strong className="text-slate-200 font-normal">{formatInr(activePoint.open)}</strong>
          </span>
          <span>
            H <strong className="text-emerald-400 font-normal">{formatInr(activePoint.high)}</strong>
          </span>
          <span>
            L <strong className="text-red-400 font-normal">{formatInr(activePoint.low)}</strong>
          </span>
          <span>
            C{' '}
            <strong
              className={
                activePoint.close >= activePoint.open
                  ? 'text-emerald-400 font-medium'
                  : 'text-red-400 font-medium'
              }
            >
              {formatInr(activePoint.close)}
            </strong>
          </span>
          <span>
            Vol <strong className="text-slate-300 font-normal">{formatIndianVolume(activePoint.volume)}</strong>
          </span>
          {showEma20 && activePoint.ema20 !== null && (
            <span className="text-blue-400">EMA20 {formatInr(activePoint.ema20)}</span>
          )}
          {showEma50 && activePoint.ema50 !== null && (
            <span className="text-amber-400">EMA50 {formatInr(activePoint.ema50)}</span>
          )}
          {showSma200 && activePoint.sma200 !== null && (
            <span className="text-slate-300">SMA200 {formatInr(activePoint.sma200)}</span>
          )}
        </div>
      )}

      <svg
        width={width}
        height={height}
        className="block overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
        role="img"
        aria-label="Interactive stock candlestick chart with technical overlays"
      >
        {/* Horizontal Grid & Y Axis Price Labels */}
        {yTicks.map((tick) => {
          const y = yForPrice(tick);
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="#1E293B"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <text
                x={width - padRight + 8}
                y={y + 4}
                fill="#64748B"
                fontSize={11}
                fontFamily="JetBrains Mono, monospace"
              >
                {tick.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Bollinger Bands Area */}
        {showBollinger && bollingerAreaPath && (
          <path d={bollingerAreaPath} fill="#3B82F6" fillOpacity={0.08} />
        )}
        {showBollinger && (
          <>
            <path
              d={buildLinePath((d) => d.bbUpper)}
              fill="none"
              stroke="#3B82F6"
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <path
              d={buildLinePath((d) => d.bbLower)}
              fill="none"
              stroke="#3B82F6"
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          </>
        )}

        {/* Support & Resistance Lines */}
        {showSupportResistance &&
          supportLevels.slice(0, 2).map((lvl, i) => {
            if (lvl < minPrice || lvl > maxPrice) return null;
            const y = yForPrice(lvl);
            return (
              <g key={`sup-${i}`}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                  stroke="#10B981"
                  strokeOpacity={0.55}
                  strokeDasharray="5 4"
                  strokeWidth={1}
                />
                <text
                  x={padLeft + 6}
                  y={y - 4}
                  fill="#10B981"
                  fontSize={10}
                  fontFamily="JetBrains Mono, monospace"
                >
                  S{i + 1} ₹{lvl.toFixed(0)}
                </text>
              </g>
            );
          })}

        {showSupportResistance &&
          resistanceLevels.slice(0, 2).map((lvl, i) => {
            if (lvl < minPrice || lvl > maxPrice) return null;
            const y = yForPrice(lvl);
            return (
              <g key={`res-${i}`}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                  stroke="#EF4444"
                  strokeOpacity={0.55}
                  strokeDasharray="5 4"
                  strokeWidth={1}
                />
                <text
                  x={padLeft + 6}
                  y={y - 4}
                  fill="#EF4444"
                  fontSize={10}
                  fontFamily="JetBrains Mono, monospace"
                >
                  R{i + 1} ₹{lvl.toFixed(0)}
                </text>
              </g>
            );
          })}

        {/* Candlesticks */}
        {data.map((bar, idx) => {
          const x = xForIndex(idx);
          const isUp = bar.close >= bar.open;
          const color = isUp ? '#10B981' : '#EF4444';
          const yHigh = yForPrice(bar.high);
          const yLow = yForPrice(bar.low);
          const yOpen = yForPrice(bar.open);
          const yClose = yForPrice(bar.close);
          const bodyTop = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));

          return (
            <g key={bar.date}>
              <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1.2} />
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={color}
                fillOpacity={isUp ? 0.9 : 0.88}
                rx={0.5}
              />
            </g>
          );
        })}

        {/* Moving Average Overlays */}
        {showEma20 && (
          <path
            d={buildLinePath((d) => d.ema20)}
            fill="none"
            stroke="#3B82F6"
            strokeWidth={1.6}
          />
        )}
        {showEma50 && (
          <path
            d={buildLinePath((d) => d.ema50)}
            fill="none"
            stroke="#F59E0B"
            strokeWidth={1.6}
          />
        )}
        {showSma200 && (
          <path
            d={buildLinePath((d) => d.sma200)}
            fill="none"
            stroke="#CBD5E1"
            strokeWidth={1.5}
            strokeDasharray="6 3"
          />
        )}

        {/* Crosshair */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <g>
            <line
              x1={xForIndex(hoveredIdx)}
              x2={xForIndex(hoveredIdx)}
              y1={padTop}
              y2={height - padBottom}
              stroke="#475569"
              strokeDasharray="2 2"
              strokeWidth={1}
            />
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={yForPrice(data[hoveredIdx].close)}
              y2={yForPrice(data[hoveredIdx].close)}
              stroke="#475569"
              strokeDasharray="2 2"
              strokeWidth={1}
            />
          </g>
        )}

        {/* X Axis Date Labels */}
        {xTickIndices.map((idx) => (
          <text
            key={idx}
            x={xForIndex(idx)}
            y={height - 8}
            textAnchor="middle"
            fill="#64748B"
            fontSize={11}
            fontFamily="JetBrains Mono, monospace"
          >
            {data[idx].date.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  );
}
