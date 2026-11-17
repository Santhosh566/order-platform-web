import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routes } from '../router'
import { fakeBackend } from '../test/fakeBackend'
import { fakeAuth, renderRoutes } from '../test/render'
import { cssVariablesResolver, isAppStyle, THEMES } from '../theme'
import { createTheme, mergeMantineTheme, DEFAULT_THEME } from '@mantine/core'

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('appearance menu', () => {
  it('sits beside the profile and remembers the chosen style', async () => {
    fakeBackend({ 'GET /api/public/catalog': { body: [] } })
    const user = userEvent.setup()
    renderRoutes(routes, '/shop', fakeAuth(['CUSTOMER']))

    await user.click(await screen.findByRole('button', { name: 'Appearance' }))
    expect(await screen.findByRole('menuitem', { name: 'Classic' })).toHaveAttribute('aria-current', 'true')

    await user.click(screen.getByRole('menuitem', { name: 'Orange & Navy' }))
    expect(window.localStorage.getItem('order-platform:style')).toBe('orange-navy')
    expect(screen.getByRole('menuitem', { name: 'Orange & Navy' })).toHaveAttribute('aria-current', 'true')

    await user.click(screen.getByRole('menuitem', { name: 'Light' }))
    expect(screen.getByRole('menuitem', { name: 'Light' })).toHaveAttribute('aria-current', 'true')
  })
})

describe('themes', () => {
  it('knows its styles', () => {
    expect(isAppStyle('orange-navy')).toBe(true)
    expect(isAppStyle('pink')).toBe(false)
  })

  it('gives Orange & Navy a white page, navy text and a navy header; Classic stays as Mantine draws it', () => {
    const orangeNavy = cssVariablesResolver(mergeMantineTheme(DEFAULT_THEME, THEMES['orange-navy']))
    expect(orangeNavy.light['--mantine-color-body']).toBe('#ffffff')
    expect(orangeNavy.light['--mantine-color-text']).toBe('#13213f')
    expect(orangeNavy.light['--app-header-bg']).toBe('#13213f')

    const classic = cssVariablesResolver(mergeMantineTheme(DEFAULT_THEME, createTheme(THEMES.classic)))
    expect(classic.light).toEqual({})
  })
})
