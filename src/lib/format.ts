export function formatInr(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatIndexValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMarketCapCr(valueCr: number): string {
  if (!Number.isFinite(valueCr)) return '—';
  if (valueCr >= 100000) {
    return `₹${(valueCr / 100000).toFixed(2)} Lakh Cr`;
  }
  return `₹${valueCr.toLocaleString('en-IN')} Cr`;
}

export function formatIndianVolume(volume: number): string {
  if (!Number.isFinite(volume)) return '—';
  if (volume >= 10_000_000) {
    return `${(volume / 10_000_000).toFixed(2)} Cr`;
  }
  if (volume >= 100_000) {
    return `${(volume / 100_000).toFixed(2)} L`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)} K`;
  }
  return volume.toLocaleString('en-IN');
}

export function formatSignedPercent(value: number): string {
  if (!Number.isFinite(value)) return '0.00%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatSignedNumber(value: number, prefix = ''): string {
  if (!Number.isFinite(value)) return '0.00';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${prefix}${Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
