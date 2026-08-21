export default function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
      color: 'var(--muted)',
      fontSize: '13px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '24px',
          height: '24px',
          border: '2px solid var(--line)',
          borderTop: '2px solid var(--blue)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 12px',
        }}></div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        Carregando…
      </div>
    </div>
  );
}
