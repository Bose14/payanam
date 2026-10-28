import { useState, useRef, useEffect } from 'react';
import { usePlaceSearch } from '../hooks/usePlaceSearch';

interface PlaceInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

function shortName(displayName: string): string {
  const parts = displayName.split(',').map(s => s.trim());
  // Return "City, State" format — first two meaningful parts
  return parts.slice(0, 2).join(', ');
}

export default function PlaceInput({ value, onChange, placeholder, style }: PlaceInputProps) {
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

  const handleSelect = (displayName: string) => {
    onChange(shortName(displayName));
    clear();
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
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
          padding: '10px 14px',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          fontSize: '15px',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'system-ui, sans-serif',
        }}
      />
      {open && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'white', border: '1px solid #e5e7eb',
          borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 9999, marginTop: '4px', padding: 0, listStyle: 'none',
        }}>
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s.display_name); }}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: '14px',
                borderBottom: i < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                lineHeight: 1.4,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.background = '#eff6ff'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.background = 'white'; }}
            >
              <div style={{ fontWeight: 500, color: '#111827' }}>{shortName(s.display_name)}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{s.display_name.split(',').slice(2, 4).join(',').trim()}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
