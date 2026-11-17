import {
  AppShell,
  Badge,
  Burger,
  Center,
  Loader,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconChevronDown, IconLogout, IconUserEdit } from '@tabler/icons-react'
import { Suspense } from 'react'
import { Link, NavLink as RouterNavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { useCart } from '../cart/CartContext'
import { homeFor } from '../auth/roles'
import { AppearanceMenu } from './AppearanceMenu'
import { AccountInactivePage } from '../pages/AccountInactivePage'
import { UserAvatar } from '../profile/UserAvatar'
import { navigationFor } from './navigation'

/**
 * Header with the user menu, a side menu for the user's roles (a drawer on phones), and the page.
 */
export function AppLayout() {
  const auth = useAuth()
  const location = useLocation()
  const [opened, { toggle, close }] = useDisclosure()
  const roles = auth.me?.roles ?? []
  const sections = navigationFor(roles)
  const inactive = auth.me?.active === false
  const cart = useCart()

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      {/* Orange & Navy gives the header a navy bar; Classic keeps the page colour */}
      <AppShell.Header
        style={{
          background: 'var(--app-header-bg, var(--mantine-color-body))',
          color: 'var(--app-header-text, inherit)',
        }}
      >
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label="Open menu"
              color="var(--app-header-text, var(--mantine-color-text))"
            />
            <Link to={homeFor(roles)} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Group gap={8} wrap="nowrap">
                <img src="/favicon.svg" alt="" width={28} height={28} />
                <Text fw={700} size="lg">
                  Order Platform
                </Text>
              </Group>
            </Link>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <AppearanceMenu />
            <Menu position="bottom-end" width={220}>
              <Menu.Target>
                <UnstyledButton aria-label="Account menu">
                  <Group gap={8} wrap="nowrap">
                    <UserAvatar
                      userId={auth.me?.userId}
                      name={auth.me?.fullName}
                      photoVersion={auth.me?.photoUpdatedAt}
                      size="sm"
                    />
                    <Text size="sm" visibleFrom="xs">
                      {auth.me?.fullName}
                    </Text>
                    <IconChevronDown size={14} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>
                  {auth.me?.userId} · {roles.join(', ')}
                  {inactive && ' · inactive'}
                </Menu.Label>
                <Menu.Item component={Link} to="/profile" leftSection={<IconUserEdit size={16} />}>
                  Edit profile
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconLogout size={16} />} onClick={() => void auth.signOut()}>
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <ScrollArea>
          <Stack gap="lg">
            {sections.map((section) => (
              <div key={section.title}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="sm" mb={4}>
                  {section.title}
                </Text>
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    component={RouterNavLink}
                    to={item.to}
                    end={item.to === '/admin' || item.to === '/delivery'}
                    label={item.label}
                    leftSection={<item.icon size={18} stroke={1.6} />}
                    rightSection={
                      item.to === '/cart' && cart.count > 0 ? (
                        <Badge size="sm" circle aria-label={`${cart.count} items`}>
                          {cart.count}
                        </Badge>
                      ) : undefined
                    }
                    active={isActive(location.pathname, item.to)}
                    onClick={close}
                  />
                ))}
              </div>
            ))}
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Suspense
          fallback={
            <Center py="xl">
              <Loader aria-label="Loading" />
            </Center>
          }
        >
          {/* An admin turned the account off: every page says so, the menu and sign-out still work */}
          {inactive ? <AccountInactivePage /> : <Outlet />}
        </Suspense>
      </AppShell.Main>
    </AppShell>
  )
}

function isActive(path: string, to: string): boolean {
  // Section home pages are active only on themselves; others also on their sub-pages
  if (to === '/admin' || to === '/delivery') {
    return path === to
  }
  return path === to || path.startsWith(to + '/')
}

