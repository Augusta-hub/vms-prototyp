import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Der Prototyp laeuft ohne weitere Konfiguration. Verbindungsdaten kommen
  // ausschliesslich aus der Umgebung (DATABASE_URL in .env), nie aus dieser Datei.
  reactStrictMode: true,
}

export default nextConfig
