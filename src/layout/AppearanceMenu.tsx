import { ActionIcon, Box, Group, Menu, Text, Tooltip, useMantineColorScheme } from '@mantine/core'
import { IconCheck, IconDeviceDesktop, IconMoon, IconPalette, IconSun } from '@tabler/icons-react'
import { useAppStyle } from '../appStyle'
import { APP_STYLES } from '../theme'

const MODES = [
  { value: 'light', label: 'Light', icon: IconSun },
  { value: 'dark', label: 'Dark', icon: IconMoon },
  { value: 'auto', label: 'Same as my device', icon: IconDeviceDesktop },
] as const

/** Light or dark, and the colour style, next to the account menu. */
export function AppearanceMenu() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const { style, setStyle } = useAppStyle()

  return (
    <Menu position="bottom-end" width={230} closeOnItemClick={false}>
      <Menu.Target>
        <Tooltip label="Appearance">
          <ActionIcon variant="subtle" size="lg" aria-label="Appearance" c="var(--app-header-text, inherit)">
            <IconPalette size={20} stroke={1.6} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Mode</Menu.Label>
        {MODES.map((mode) => (
          <Menu.Item
            key={mode.value}
            leftSection={<mode.icon size={16} />}
            rightSection={colorScheme === mode.value ? <IconCheck size={14} /> : null}
            onClick={() => setColorScheme(mode.value)}
            // Mantine fixes role="menuitem"; aria-current tells screen readers which one is chosen
            aria-current={colorScheme === mode.value ? 'true' : undefined}
          >
            {mode.label}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Label>Style</Menu.Label>
        {APP_STYLES.map((option) => (
          <Menu.Item
            key={option.value}
            leftSection={<Swatches colors={option.swatches} />}
            rightSection={style === option.value ? <IconCheck size={14} /> : null}
            onClick={() => setStyle(option.value)}
            aria-current={style === option.value ? 'true' : undefined}
          >
            <Text size="sm">{option.label}</Text>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

function Swatches({ colors }: { colors: [string, string] }) {
  return (
    <Group gap={0} aria-hidden>
      {colors.map((color, i) => (
        <Box
          key={color}
          w={12}
          h={16}
          bg={color}
          style={{
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: i === 0 ? '3px 0 0 3px' : '0 3px 3px 0',
          }}
        />
      ))}
    </Group>
  )
}
