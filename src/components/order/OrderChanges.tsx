import { Badge, Button, Menu, Modal, Paper, Stack, Text, Timeline, Title } from '@mantine/core'
import { IconCalendarEvent, IconChevronDown, IconEdit, IconMapPin, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import type { Order } from '../../api/types'
import { formatDateTime, formatMoney } from '../../lib/format'
import {
  canAddItems,
  canChangeDelivery,
  CHANGE_LABELS,
  useOrderChanges,
  type OrderChange,
  type OrderChangeKind,
} from '../../orders/changes'
import { AddItemsDialog } from './AddItemsDialog'
import { ChangeAddressDialog } from './ChangeAddressDialog'
import { ChangeSlotDialog } from './ChangeSlotDialog'

type Dialog = 'address' | 'slot' | 'items' | null

/**
 * "Change order": a new address or delivery day until a driver takes the parcel, more items until it is packed.
 * Nothing is shown when no change is possible any more.
 */
export function ChangeOrderMenu({ order, staff = false }: { order: Order; staff?: boolean }) {
  const [open, setOpen] = useState<Dialog>(null)
  const delivery = canChangeDelivery(order)
  const items = canAddItems(order)
  if (!delivery && !items) return null
  const close = () => setOpen(null)
  return (
    <>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Button variant="default" leftSection={<IconEdit size={18} />} rightSection={<IconChevronDown size={14} />}>
            Change order
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {delivery && (
            <Menu.Item leftSection={<IconMapPin size={16} />} onClick={() => setOpen('address')}>
              Delivery address
            </Menu.Item>
          )}
          {delivery && (
            <Menu.Item leftSection={<IconCalendarEvent size={16} />} onClick={() => setOpen('slot')}>
              Delivery day and time
            </Menu.Item>
          )}
          {items && (
            <Menu.Item leftSection={<IconPlus size={16} />} onClick={() => setOpen('items')}>
              Add items
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
      <Modal opened={open === 'address'} onClose={close} title="Change the delivery address" size="lg">
        <ChangeAddressDialog order={order} staff={staff} onDone={close} />
      </Modal>
      <Modal opened={open === 'slot'} onClose={close} title="Change the delivery day">
        <ChangeSlotDialog order={order} onDone={close} />
      </Modal>
      <Modal opened={open === 'items'} onClose={close} title="Add items to this order" size="lg">
        <AddItemsDialog order={order} staff={staff} onDone={close} />
      </Modal>
    </>
  )
}

const ICONS: Record<OrderChangeKind, typeof IconMapPin> = {
  ADDRESS: IconMapPin,
  DELIVERY_SLOT: IconCalendarEvent,
  ITEMS_ADDED: IconPlus,
}

function who(change: OrderChange, staff: boolean): string {
  if (staff) return change.byStaff ? `Support (${change.changedBy})` : `Customer (${change.changedBy})`
  return change.byStaff ? 'Our support team' : 'You'
}

/** Every change made after the order was placed, oldest first. Hidden until there is one. */
export function OrderChangeHistory({ order, staff = false }: { order: Order; staff?: boolean }) {
  const changes = useOrderChanges(order.orderId)
  const list = changes.data ?? []
  if (list.length === 0) return null
  return (
    <Paper withBorder radius="md" p="md">
      <Title order={4} mb="sm">
        Changes to this order
      </Title>
      <Timeline bulletSize={24} lineWidth={2} aria-label="Changes to this order">
        {list.map((c) => {
          const Icon = ICONS[c.kind]
          return (
            <Timeline.Item key={c.id} bullet={<Icon size={14} />} title={CHANGE_LABELS[c.kind]}>
              <Stack gap={2}>
                {c.before && (
                  <Text size="xs" c="dimmed" td="line-through">
                    {c.before}
                  </Text>
                )}
                <Text size="sm">
                  {c.after}
                  {c.amount !== null && (
                    <Badge ml="xs" size="sm" variant="light">
                      {formatMoney(c.amount, order.currency)}
                    </Badge>
                  )}
                </Text>
                {c.note && (
                  <Text size="xs" c="dimmed">
                    {c.note}
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  {who(c, staff)} · {formatDateTime(c.createdAt)}
                </Text>
              </Stack>
            </Timeline.Item>
          )
        })}
      </Timeline>
    </Paper>
  )
}
