import { Button, Group, Select } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useAssignDriver, useAssignPickup, useDrivers } from '../../admin/queries'
import { notifyFailure } from '../../lib/notifyFailure'

/**
 * Choose a delivery user for an order, or for a return pickup (returnId); drivers with less work
 * in hand (deliveries and pickups) are listed first.
 */
export function AssignDriver({
  orderId,
  version,
  returnId,
  current,
  label = 'Assign',
}: {
  orderId?: string
  /** The order version the admin was shown, so an order someone else assigned meanwhile is not taken over */
  version?: number
  returnId?: string
  current?: string
  label?: string
}) {
  const drivers = useDrivers()
  const assignOrder = useAssignDriver()
  const assignPickup = useAssignPickup()
  const assign = returnId ? assignPickup : assignOrder
  const target = returnId ?? orderId ?? ''
  const [driver, setDriver] = useState<string | null>(null)

  const options = [...(drivers.data ?? [])]
    .sort((a, b) => a.activeDeliveries - b.activeDeliveries || a.fullName.localeCompare(b.fullName))
    .filter((d) => d.userId !== current)
    .map((d) => ({
      value: d.userId,
      label: `${d.fullName} · ${d.activeDeliveries} in hand`,
    }))

  const submit = () => {
    if (!driver) return
    const handlers = {
      onSuccess: () => {
        const name = drivers.data?.find((d) => d.userId === driver)?.fullName ?? driver
        notifications.show({
          color: 'green',
          title: 'Driver assigned',
          message: `${name} has the ${returnId ? 'pickup' : 'order'} now.`,
        })
        setDriver(null)
      },
      onError: (error: unknown) => notifyFailure('Not assigned', error),
    }
    if (returnId) {
      assignPickup.mutate({ returnId, deliveryUserId: driver }, handlers)
    } else {
      assignOrder.mutate({ orderId: target, deliveryUserId: driver, version }, handlers)
    }
  }

  return (
    <Group gap="xs" wrap="nowrap">
      <Select
        aria-label={`Driver for ${target}`}
        placeholder={drivers.isPending ? 'Loading drivers…' : 'Choose driver'}
        data={options}
        value={driver}
        onChange={setDriver}
        size="xs"
        w={210}
        nothingFoundMessage="No active drivers"
        disabled={assign.isPending}
      />
      <Button size="xs" onClick={submit} disabled={!driver} loading={assign.isPending}>
        {label}
      </Button>
    </Group>
  )
}
