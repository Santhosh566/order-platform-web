import { createContext, useContext } from 'react'
import type { AppStyle } from './theme'

export interface StyleState {
  style: AppStyle
  setStyle: (style: AppStyle) => void
}

export const StyleContext = createContext<StyleState | null>(null)

/** The colour style the user chose (Classic or Orange & Navy), and a way to change it. */
export function useAppStyle(): StyleState {
  const state = useContext(StyleContext)
  if (!state) throw new Error('useAppStyle must be used inside <AppThemeProvider>')
  return state
}
