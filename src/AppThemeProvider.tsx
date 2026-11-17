import { MantineProvider } from '@mantine/core'
import { useMemo, useState, type ReactNode } from 'react'
import { StyleContext, type StyleState } from './appStyle'
import { cssVariablesResolver, isAppStyle, THEMES, type AppStyle } from './theme'

const STORAGE_KEY = 'order-platform:style'

/**
 * Mantine with the chosen style. The style is remembered in this browser; the light/dark mode is
 * remembered by Mantine itself. Neither is stored on the server: they are per-device preferences.
 */
export function AppThemeProvider({
  children,
  env,
  initialStyle,
}: {
  children: ReactNode
  env?: 'default' | 'test'
  initialStyle?: AppStyle
}) {
  const [style, setStyleState] = useState<AppStyle>(() => initialStyle ?? readStyle())

  const value = useMemo<StyleState>(
    () => ({
      style,
      setStyle: (next) => {
        setStyleState(next)
        try {
          window.localStorage.setItem(STORAGE_KEY, next)
        } catch {
          // Storage blocked: the choice lasts for this visit
        }
      },
    }),
    [style],
  )

  return (
    <StyleContext.Provider value={value}>
      <MantineProvider
        theme={THEMES[style]}
        cssVariablesResolver={cssVariablesResolver}
        defaultColorScheme="auto"
        env={env}
      >
        {children}
      </MantineProvider>
    </StyleContext.Provider>
  )
}

function readStyle(): AppStyle {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return isAppStyle(saved) ? saved : 'classic'
  } catch {
    return 'classic'
  }
}
