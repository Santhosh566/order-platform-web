import { Select, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useDrivers } from '../admin/queries'
import { errorMessage } from '../lib/errors'
import { useMoveDriver, usePublicWarehouses } from './queries'

/** "Ships from Gurugram fulfilment centre", on an order. */
export function ShipsFrom({ warehouseId }: { warehouseId?: number | null }) {
  const warehouses = usePublicWarehouses()
  const name = warehouses.data?.find((w) => w.id === warehouseId)?.name
  if (!name) return null
  return <Text size="sm">Ships from {name}</Text>
}

/** The warehouse a driver works from, which an admin can change: they then see that warehouse's deliveries. */
export function DriverWarehouse({ userId }: { userId: string }) {
  const warehouses = usePublicWarehouses()
  const drivers = useDrivers()
  const move = useMoveDriver(userId)
  const current = drivers.data?.find((d) => d.userId === userId)?.warehouseId
  if (!warehouses.data || current === undefined) return null
  return (
    <Select
      label="Works from"
      description="They see and take only this warehouse's deliveries and return pickups."
      data={warehouses.data.map((w) => ({ value: String(w.id), label: `${w.code} · ${w.name}` }))}
      value={String(current)}
      allowDeselect={false}
      disabled={move.isPending}
      onChange={(value) =>
        value &&
        move.mutate(Number(value), {
          onSuccess: (w) => notifications.show({ color: 'green', title: 'Driver moved', message: `Now works from ${w.name}` }),
          onError: (error) => notifications.show({ color: 'red', title: 'Not moved', message: errorMessage(error) }),
        })
      }
      maw={360}
    />
  )
}
