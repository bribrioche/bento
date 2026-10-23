/// <reference types="vite/client" />

interface HubApp {
  id: string
  name: string
  description?: string
  path: string
  icon: string
  addedAt: string
  lastLaunchedAt?: string
  launchCount: number
}

interface CatalogApp {
  id: string
  name: string
  version: string
  category: string
  description: string
  icon: string
  installed: boolean
  installerAvailable: boolean
  sourceAvailable: boolean
}

interface HubApi {
  listCatalog: () => Promise<CatalogApp[]>
  selectWorkspace: () => Promise<CatalogApp[] | null>
  installCatalogApp: (id: string) => Promise<CatalogApp[]>
  launchCatalogApp: (id: string) => Promise<boolean>
  listApps: () => Promise<HubApp[]>
  addApp: () => Promise<HubApp | null>
  updateApp: (id: string, name: string, description: string) => Promise<HubApp[]>
  removeApp: (id: string) => Promise<HubApp[]>
  refreshIcon: (id: string) => Promise<HubApp[]>
  launchApp: (id: string) => Promise<HubApp[]>
  setTheme: (theme: 'light' | 'dark') => Promise<void>
}

interface Window { hub: HubApi }
