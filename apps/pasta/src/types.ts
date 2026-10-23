export type Note = {
  id: string;
  description: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type NoteInput = Pick<Note, "description" | "text">;

declare global {
  interface Window {
    pasta: {
      listNotes: () => Promise<Note[]>;
      createNote: (note: NoteInput) => Promise<Note>;
      updateNote: (id: string, note: NoteInput) => Promise<Note>;
      removeNote: (id: string) => Promise<boolean>;
      copyText: (value: string) => Promise<boolean>;
      setTheme: (theme: "light" | "dark") => Promise<void>;
    };
  }
}

export {};
