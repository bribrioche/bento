/// <reference types="vite/client" />
interface ProjectFolder { id:string; name:string; path:string; description:string; addedAt:string; lastLaunchedAt?:string }
interface TerminalOption { id:string; name:string; custom:boolean }
interface TerminalSettings { selected:string; options:TerminalOption[] }
interface AgentLauncherApi {
  listFolders:()=>Promise<ProjectFolder[]>
  addFolder:()=>Promise<ProjectFolder|null>
  updateFolder:(id:string,name:string,description:string)=>Promise<ProjectFolder[]>
  removeFolder:(id:string)=>Promise<ProjectFolder[]>
  launch:(id:string,agent:'claude'|'codex')=>Promise<ProjectFolder[]>
  getTerminals:()=>Promise<TerminalSettings>
  setTerminal:(terminal:string)=>Promise<TerminalSettings>
  pickTerminalApp:()=>Promise<{name:string;path:string;args:string}|null>
  addTerminalApp:(input:{name:string;path:string;args:string})=>Promise<TerminalSettings>
  removeTerminalApp:(id:string)=>Promise<TerminalSettings>
  setTheme:(theme:'light'|'dark')=>Promise<void>
}
interface Window { agentLauncher:AgentLauncherApi }
