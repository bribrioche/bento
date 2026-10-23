/// <reference types="vite/client" />

type RecentFile = {
  path: string
  name: string
  size: number
  modifiedAt: string
  openedAt: string
}

type MarkdownDocument = RecentFile & {
  content: string
}

type SaveResult = Pick<MarkdownDocument, 'size' | 'modifiedAt'>

interface Window {
  lumen?: {
    chooseFile: () => Promise<MarkdownDocument | null>
    openRecent: (filePath: string) => Promise<MarkdownDocument>
    reloadDocument: (filePath: string) => Promise<MarkdownDocument>
    saveDocument: (filePath: string, content: string) => Promise<SaveResult>
    listRecents: () => Promise<RecentFile[]>
    removeRecent: (filePath: string) => Promise<RecentFile[]>
    clearRecents: () => Promise<RecentFile[]>
    showInFolder: (filePath: string) => Promise<void>
    openExternal: (url: string) => Promise<void>
    onFileOpened: (callback: (document: MarkdownDocument) => void) => () => void
    onFilesDropped: (callback: (documents: MarkdownDocument[]) => void) => () => void
    onFileError: (callback: (message: string) => void) => () => void
  }
}
