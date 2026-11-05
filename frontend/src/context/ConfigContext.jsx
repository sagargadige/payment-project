import { createContext, useContext, useEffect, useState } from 'react';
import { configApi } from '../api/client.js';

/**
 * Loads public runtime config (PayPal client id + mode) from the backend so the
 * frontend never hard-codes credentials.
 */
const ConfigContext = createContext({ paypalClientId: '', paypalMode: 'sandbox', loading: true });

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState({ paypalClientId: '', paypalMode: 'sandbox', loading: true });

  useEffect(() => {
    configApi
      .get()
      .then((data) => setConfig({ ...data, loading: false }))
      .catch(() => setConfig({ paypalClientId: '', paypalMode: 'sandbox', loading: false }));
  }, []);

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export const useConfig = () => useContext(ConfigContext);
export default ConfigContext;
