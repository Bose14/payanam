import { useState, useRef, useEffect } from 'react';
import { usePlaceSearch } from '../hooks/usePlaceSearch';

export interface PlaceLocation {
  name: string;
  lat: number;
  lng: number;
}

interface PlaceInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (loc: PlaceLocation) => void;
  onLocationSelect?: (loc: PlaceLocation) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

function shortName(displayName: string): string {
  return displayName.split(',').slice(0, 2).map(s => s.trim()).join(', ');
}

export default function PlaceInput({
  value,
  onChange,
  onSelect,
  onLocationSelect,
  placeholder,
  style,
}: PlaceInputProps) {
  const { suggestions, search, clear } = usePlaceSearch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        clear();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [clear]);

  const handleSelect = (s: { display_name: string; lat: string; lon: string }) => {
    const name = shortName(s.display_name);
    const loc: PlaceLocation = { name, lat: parseFloat(s.lat), lng: parseFloat(s.lon) };
    onChange(name);
    onSelect?.(loc);
    onLocationSelect?.(loc);
    clear();
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          search(e.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: '100%',
          padding: '12px 14px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-input)',
          borderRadius: 10,
          color: 'var(--text-primary)',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          transition: 'border-color 0.15s ease, background-color 0.2s ease',
        }}
      />
      {open && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 10,
          boxShadow: 'var(--card-shadow)',
          zIndex: 9999,
          marginTop: 6,
          padding: 4,
          listStyle: 'none',
          maxHeight: '45vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                borderRadius: 8,
                fontSize: 13,
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLLIElement).style.background = 'var(--bg-subtle)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLLIElement).style.background = 'transparent';
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{shortName(s.display_name)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {s.display_name.split(',').slice(2, 4).join(',').trim()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
