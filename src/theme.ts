import { createTheme, type CSSVariablesResolver, type MantineColorsTuple, type MantineThemeOverride } from '@mantine/core'

/**
 * The app's looks. The mode (light, dark, system) is Mantine's colour scheme; the style is ours:
 * Classic (blue) or Orange & Navy, a minimalist look with navy text and orange actions.
 * Status colours (green delivered, red failed, …) carry meaning and are the same in every style.
 */

export type AppStyle = 'classic' | 'orange-navy'

export const APP_STYLES: ReadonlyArray<{ value: AppStyle; label: string; swatches: [string, string] }> = [
  { value: 'classic', label: 'Classic', swatches: ['#228be6', '#f8f9fa'] },
  { value: 'orange-navy', label: 'Orange & Navy', swatches: ['#e8590c', '#13213f'] },
]

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif'

const classic = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily: FONT,
  headings: { fontWeight: '700' },
})

/** Orange for actions. Filled buttons use shade 7, dark enough for white text (contrast ≥ 4.5:1). */
const orange: MantineColorsTuple = [
  '#fff4ec',
  '#ffe8d6',
  '#ffcfa8',
  '#ffb276',
  '#ff964a',
  '#fd7e2a',
  '#f06d17',
  '#c4520a',
  '#a34408',
  '#843707',
]

/** Navy for text, headers and the dark mode surfaces. */
const navy: MantineColorsTuple = [
  '#eef1f8',
  '#dbe1ef',
  '#b4c0dc',
  '#8a9cc8',
  '#677eb7',
  '#516bad',
  '#4561a9',
  '#365194',
  '#2d4785',
  '#13213f',
]

/** Mantine draws dark mode from the "dark" scale; here it is a navy night instead of grey. */
const navyNight: MantineColorsTuple = [
  '#d5dbe8',
  '#b3bdd3',
  '#8c98b5',
  '#65728f',
  '#3f4c6a',
  '#2b3753',
  '#1f2a44',
  '#152038',
  '#101a2f',
  '#0b1324',
]

const orangeNavy = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 7, dark: 7 },
  colors: { brand: orange, navy, dark: navyNight },
  // Body text in light mode
  black: navy[9],
  defaultRadius: 'sm',
  fontFamily: FONT,
  headings: { fontWeight: '650' },
  autoContrast: true,
  components: {
    // Minimalist: hairline borders instead of shadows
    Paper: { defaultProps: { shadow: undefined } },
    Card: { defaultProps: { shadow: undefined } },
    Button: { defaultProps: { fw: 600 } },
    Badge: { defaultProps: { radius: 'sm' } },
  },
})

export const THEMES: Record<AppStyle, MantineThemeOverride> = { classic, 'orange-navy': orangeNavy }

/** Light mode of Orange & Navy: pure white page, navy text, very light borders. */
export const cssVariablesResolver: CSSVariablesResolver = (theme) => {
  const none: Record<string, string> = {}
  if (theme.primaryColor !== 'brand') {
    return { variables: none, light: none, dark: none }
  }
  return {
    variables: {},
    light: {
      '--mantine-color-body': '#ffffff',
      '--mantine-color-text': navy[9],
      '--mantine-color-dimmed': '#5b6785',
      '--mantine-color-default-border': '#e3e7ef',
      // Text of "light" buttons, badges and the active menu item: one shade darker than the
      // filled colour, so it stays readable on its pale orange tint (6:1 instead of 4.3:1)
      '--mantine-color-brand-light-color': orange[8],
      '--app-header-bg': navy[9],
      '--app-header-text': '#ffffff',
    },
    dark: {
      '--mantine-color-body': navyNight[8],
      '--app-header-bg': navyNight[9],
      '--app-header-text': navyNight[0],
    },
  }
}

export function isAppStyle(value: unknown): value is AppStyle {
  return value === 'classic' || value === 'orange-navy'
}
