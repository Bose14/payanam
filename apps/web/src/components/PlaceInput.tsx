import { useState, useRef, useEffect } from 'react';
import { usePlaceSearch } from '../hooks/usePlaceSearch';

interface PlaceInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export default function PlaceInput({ value, onChange, placeholder, style }: PlaceInputProps) {
  const { suggestions, search, clear } = usePlaceSearch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); search(e.target.value); setOpen(true); }}
        placeholder={placeholder}
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
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'white', border: '1px solid #e5e7eb',
          borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 1000, marginTop: '4px',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => {
                onChange(s.display_name.split(',').slice(0, 2).join(',').trim());
                clear();
                setOpen(false);
              }}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: '13px',
                borderBottom: i < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'white'; }}
            >
              {s.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
