const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
let mainWindow
function storePath(){return path.join(app.getPath('userData'),'folders.json')}
function settingsPath(){return path.join(app.getPath('userData'),'settings.json')}
async function readFolders(){try{return JSON.parse(await fs.readFile(storePath(),'utf8'))}catch{return[]}}
async function writeFolders(items){await fs.mkdir(app.getPath('userData'),{recursive:true});await fs.writeFile(storePath(),JSON.stringify(items,null,2),'utf8');return items}
async function readSettings(){try{return JSON.parse(await fs.readFile(settingsPath(),'utf8'))}catch{return{terminal:'windows-terminal'}}}
async function writeSettings(settings){await fs.mkdir(app.getPath('userData'),{recursive:true});await fs.writeFile(settingsPath(),JSON.stringify(settings,null,2),'utf8');return settings}
function titleBar(theme){return theme==='dark'?{color:'#201d24',symbolColor:'#eeeaf2',height:48}:{color:'#ffffff',symbolColor:'#25222b',height:48}}
const builtInTerminals=[{id:'windows-terminal',name:'Windows Terminal',custom:false},{id:'powershell',name:'PowerShell',custom:false},{id:'command-prompt',name:'Command Prompt',custom:false}]
function terminalResult(settings){
  const customTerminals=Array.isArray(settings.customTerminals)?settings.customTerminals:[]
  const options=[...builtInTerminals,...customTerminals.map(({id,name})=>({id,name,custom:true}))]
  const selected=options.some((item)=>item.id===settings.terminal)?settings.terminal:'windows-terminal'
  return{selected,options}
}
function parseArguments(template,directory,command){
  const args=[];const matcher=/"([^"]*)"|'([^']*)'|([^\s]+)/g;let match
  while((match=matcher.exec(template||'')))args.push((match[1]??match[2]??match[3]).replaceAll('{cwd}',directory).replaceAll('{command}',command))
  return args
}

async function openAgentTerminal(directory,agent,terminal){
  await fs.access(directory)
  const command=agent==='claude'?'claude':'codex --yolo'
  if(process.platform==='win32'){
    const options={cwd:directory,detached:true,stdio:'ignore',windowsHide:false}
    if(terminal==='powershell'){
      spawn('powershell.exe',['-NoExit','-Command',command],options).unref();return
    }
    if(terminal==='command-prompt'){
      spawn('cmd.exe',['/K',command],options).unref();return
    }
    if(terminal.startsWith('custom:')){
      const settings=await readSettings();const custom=(settings.customTerminals||[]).find((item)=>item.id===terminal)
      if(!custom)throw new Error('The selected terminal application could not be found.')
      await fs.access(custom.path)
      spawn(custom.path,parseArguments(custom.args,directory,command),options).unref();return
    }
    const child=spawn('wt.exe',['-d',directory,'powershell.exe','-NoExit','-Command',command],options)
    child.on('error',()=>spawn('powershell.exe',['-NoExit','-Command',command],options).unref())
    child.unref();return
  }
  throw new Error('Agent Launcher currently supports Windows terminals.')
}

function createWindow(){
  mainWindow=new BrowserWindow({width:1100,height:740,minWidth:800,minHeight:560,backgroundColor:'#f8f7fa',icon:path.join(__dirname,'..','assets','icon.png'),titleBarStyle:'hidden',titleBarOverlay:titleBar('light'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}})
  if(isDev)mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);else mainWindow.loadFile(path.join(__dirname,'..','dist','index.html'))
}

app.whenReady().then(()=>{
  ipcMain.handle('folders:list',()=>readFolders())
  ipcMain.handle('folders:add',async()=>{
    const result=await dialog.showOpenDialog(mainWindow,{title:'Add a project folder',properties:['openDirectory']})
    if(result.canceled||!result.filePaths[0])return null
    const selected=path.resolve(result.filePaths[0]);const folders=await readFolders()
    const existing=folders.find(item=>path.resolve(item.path).toLowerCase()===selected.toLowerCase());if(existing)return existing
    const item={id:crypto.randomUUID(),name:path.basename(selected)||selected,description:'',path:selected,addedAt:new Date().toISOString()}
    await writeFolders([...folders,item]);return item
  })
  ipcMain.handle('folders:update',async(_event,input)=>{
    const name=String(input.name||'').trim().slice(0,80);const description=String(input.description||'').trim().slice(0,240)
    if(!name)throw new Error('Folder name cannot be empty.')
    const folders=await readFolders();const index=folders.findIndex(item=>item.id===input.id);if(index<0)throw new Error('Folder not found.')
    folders[index]={...folders[index],name,description};return writeFolders(folders)
  })
  ipcMain.handle('folders:remove',async(_event,id)=>writeFolders((await readFolders()).filter(item=>item.id!==id)))
  ipcMain.handle('terminal:list',async()=>terminalResult(await readSettings()))
  ipcMain.handle('terminal:set',async(_event,terminal)=>{
    const settings=await readSettings();const result=terminalResult(settings)
    if(!result.options.some((item)=>item.id===terminal))throw new Error('Unsupported terminal application.')
    const next={...settings,terminal};await writeSettings(next);return terminalResult(next)
  })
  ipcMain.handle('terminal:pick',async()=>{
    const result=await dialog.showOpenDialog(mainWindow,{title:'Choose a terminal application',properties:['openFile'],filters:[{name:'Applications',extensions:['exe','cmd','bat']}]})
    if(result.canceled||!result.filePaths[0])return null
    const selected=path.resolve(result.filePaths[0]);const base=path.basename(selected,path.extname(selected));const lower=base.toLowerCase()
    const args=lower.includes('powershell')||lower==='pwsh'?'-NoExit -Command {command}':lower==='cmd'?'/K {command}':lower==='wt'||lower.includes('terminal')?'-d "{cwd}" powershell.exe -NoExit -Command {command}':'{command}'
    return{name:base,path:selected,args}
  })
  ipcMain.handle('terminal:add',async(_event,input)=>{
    const selectedPath=path.resolve(String(input.path||''));await fs.access(selectedPath)
    const name=String(input.name||'').trim().slice(0,60);const args=String(input.args||'').trim().slice(0,500)
    if(!name)throw new Error('Application name is required.')
    if(!args.includes('{command}'))throw new Error('Arguments must contain {command}.')
    const settings=await readSettings();const customTerminals=Array.isArray(settings.customTerminals)?settings.customTerminals:[]
    const existing=customTerminals.find((item)=>path.resolve(item.path).toLowerCase()===selectedPath.toLowerCase())
    const item=existing?{...existing,name,args}:{id:`custom:${crypto.randomUUID()}`,name,path:selectedPath,args}
    const nextList=existing?customTerminals.map((entry)=>entry.id===existing.id?item:entry):[...customTerminals,item]
    const next={...settings,customTerminals:nextList,terminal:item.id};await writeSettings(next);return terminalResult(next)
  })
  ipcMain.handle('terminal:remove',async(_event,id)=>{
    const settings=await readSettings();const customTerminals=(settings.customTerminals||[]).filter((item)=>item.id!==id)
    const next={...settings,customTerminals,terminal:settings.terminal===id?'windows-terminal':settings.terminal};await writeSettings(next);return terminalResult(next)
  })
  ipcMain.handle('agent:launch',async(_event,input)=>{
    if(input.agent!=='claude'&&input.agent!=='codex')throw new Error('Unsupported agent command.')
    const folders=await readFolders();const index=folders.findIndex(item=>item.id===input.id);if(index<0)throw new Error('Folder not found.')
    const terminal=(await readSettings()).terminal||'windows-terminal'
    await openAgentTerminal(folders[index].path,input.agent,terminal);folders[index]={...folders[index],lastLaunchedAt:new Date().toISOString()};return writeFolders(folders)
  })
  ipcMain.handle('theme:set',(_event,theme)=>{const value=theme==='dark'?'dark':'light';if(mainWindow&&!mainWindow.isDestroyed()){mainWindow.setTitleBarOverlay(titleBar(value));mainWindow.setBackgroundColor(value==='dark'?'#17151b':'#f7f6f9')}})
  createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})
})
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})
