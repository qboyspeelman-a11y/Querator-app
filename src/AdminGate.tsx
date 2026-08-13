import React, { useState } from 'react';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const [passcode, setPasscode] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(
    sessionStorage.getItem('admin_auth') === 'true'
  );
  const [error, setError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const secretCode = import.meta.env.VITE_ADMIN_PASSCODE || 'SuperSecretAdmin123!';

    if (passcode === secretCode) {
      setIsAuthorized(true);
      sessionStorage.setItem('admin_auth', 'true');
      setError(false);
    } else {
      setError(true);
      setPasscode('');
    }
  };

  if (!isAuthorized) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
        <form onSubmit={handleLogin} style={{ background: '#1e293b', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', width: '320px', textAlign: 'center' }}>
          <h2>Restricted Area</h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px' }}>Enter the administrative passkey to proceed.</p>
          <input 
            type="password" 
            placeholder="Enter complex code..." 
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', marginBottom: '15px', boxSizing: 'border-box' }}
          />
          <button type="submit" style={{ width: '100%', padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            Unlock
          </button>
          {error && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '10px' }}>Invalid access code.</p>}
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
