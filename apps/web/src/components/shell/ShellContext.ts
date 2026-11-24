import { createContext, useContext } from 'react';

/** True when a screen is rendered inside the 5-tab app shell (which supplies its own header and nav). */
export const ShellContext = createContext(false);

export function useInShell(): boolean {
  return useContext(ShellContext);
}
