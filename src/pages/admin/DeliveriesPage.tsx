import { DriverPerformance } from './DriverPerformance'
import { Anchor, Badge, Group, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { Link } from 'react-router'
import {
  useDeliveriesInProgress,
  useDrivers,
  usePickupsInProgress,
  useWaitingDeliveries,
  useWaitingPickups,
} from '../../admin/queries'
import { LiveIndicator } from '../../components/LiveIndicator'
import { QueryState } from '../../components/QueryState'
import { StatusBadge } from '../../components/StatusBadge'
import { useLiveOrders } from '../../customer/useLiveOrders'
import { formatDateTime } from '../../lib/format'
import { shortOrderId } from '../../lib/orderStatus'
import { AssignDriver } from './AssignDriver'

/**
 * The delivery board: orders nobody holds yet, deliveries under way (reassignable until the
 * goods are collected), return pickups, and how much each driver has in hand.
 */
export function DeliveriesPage() {
  const live = useLiveOrders()
  const waiting = useWaitingDeliveries()
  const inProgress = useDeliveriesInProgress()
  const drivers = useDrivers()
  const waitingPickups = useWaitingPickups()
  const pickupsInProgress = usePickupsInProgress()

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Deliveries</Title>
        <LiveIndicator state={live} />
      </Group>

      <Paper withBorder radius="md" p="md">
        <Title order={4} mb="sm">
          Waiting for a driver
        </Title>
        <QueryState query={waiting}>
          {(rows) =>
            rows.length === 0 ? (
              <Text c="dimmed" size="sm">
                Nothing is waiting.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={760}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Order</Table.Th>
                      <Table.Th>Area</Table.Th>
                      <Table.Th ta="right">Items</Table.Th>
                      <Table.Th>Waiting since</Table.Th>
                      <Table.Th>Driver</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((row) => (
                      <Table.Tr key={row.orderId}>
                        <Table.Td>
                          <Anchor component={Link} to={`/admin/orders/${encodeURIComponent(row.orderId)}`}>
                            {shortOrderId(row.orderId)}
                          </Anchor>
                          {row.status === 'DELIVERY_FAILED' && (
                            <Badge size="xs" color="yellow" variant="light" ml={6}>
                              Retry
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {row.city}, {row.state} {row.postalCode}
                        </Table.Td>
                        <Table.Td ta="right">{row.itemCount}</Table.Td>
                        <Table.Td>{formatDateTime(row.waitingSince)}</Table.Td>
                        <Table.Td>
                          <AssignDriver orderId={row.orderId} version={row.version} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )
          }
        </QueryState>
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Title order={4} mb="sm">
          Under way
        </Title>
        <QueryState query={inProgress}>
          {(rows) =>
            rows.length === 0 ? (
              <Text c="dimmed" size="sm">
                No deliveries under way.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={820}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Order</Table.Th>
                      <Table.Th>Driver</Table.Th>
                      <Table.Th>Stage</Table.Th>
                      <Table.Th>Area</Table.Th>
                      <Table.Th>Since</Table.Th>
                      <Table.Th>Reassign</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((row) => (
                      <Table.Tr key={row.orderId}>
                        <Table.Td>
                          <Anchor component={Link} to={`/admin/orders/${encodeURIComponent(row.orderId)}`}>
                            {shortOrderId(row.orderId)}
                          </Anchor>
                          {row.attempt > 1 && (
                            <Text size="xs" c="dimmed">
                              Attempt {row.attempt}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>{row.deliveryUserName}</Table.Td>
                        <Table.Td>
                          {row.deliveryStatus === 'ASSIGNED' ? (
                            <Badge variant="light" color="blue" size="sm">
                              Not collected yet
                            </Badge>
                          ) : (
                            <StatusBadge status={row.status} size="sm" />
                          )}
                        </Table.Td>
                        <Table.Td>
                          {row.city}, {row.state}
                        </Table.Td>
                        <Table.Td>{formatDateTime(row.pickedUpAt ?? row.assignedAt)}</Table.Td>
                        <Table.Td>
                          {row.deliveryStatus === 'ASSIGNED' ? (
                            <AssignDriver orderId={row.orderId} version={row.version} current={row.deliveryUserId} label="Reassign" />
                          ) : (
                            <Text size="xs" c="dimmed">
                              With the driver
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )
          }
        </QueryState>
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Title order={4} mb={4}>
          Return pickups
        </Title>
        <Text size="sm" c="dimmed" mb="sm">
          Approved returns to collect from customers. The refund follows once the goods are checked at the hub.
        </Text>
        <QueryState query={waitingPickups}>
          {(rows) => {
            const underWay = pickupsInProgress.data ?? []
            if (rows.length === 0 && underWay.length === 0) {
              return (
                <Text c="dimmed" size="sm">
                  No pickups waiting or under way.
                </Text>
              )
            }
            return (
              <Table.ScrollContainer minWidth={820}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Return</Table.Th>
                      <Table.Th>Area</Table.Th>
                      <Table.Th>Stage</Table.Th>
                      <Table.Th>Since</Table.Th>
                      <Table.Th>Driver</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((row) => (
                      <Table.Tr key={row.returnId}>
                        <Table.Td>
                          <Anchor component={Link} to={`/admin/orders/${encodeURIComponent(row.orderId)}`}>
                            {shortOrderId(row.orderId)}
                          </Anchor>
                          <Text size="xs" c="dimmed">
                            {row.itemCount} {row.itemCount === 1 ? 'item' : 'items'}
                            {row.attempts > 0 && <> · {row.attempts} failed {row.attempts === 1 ? 'try' : 'tries'}</>}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {row.city}, {row.state} {row.postalCode}
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="orange" size="sm">
                            Waiting for a driver
                          </Badge>
                        </Table.Td>
                        <Table.Td>{formatDateTime(row.approvedAt)}</Table.Td>
                        <Table.Td>
                          <AssignDriver returnId={row.returnId} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {underWay.map((row) => (
                      <Table.Tr key={row.returnId}>
                        <Table.Td>
                          <Anchor component={Link} to={`/admin/orders/${encodeURIComponent(row.orderId)}`}>
                            {shortOrderId(row.orderId)}
                          </Anchor>
                          {row.attempt > 1 && (
                            <Text size="xs" c="dimmed">
                              Attempt {row.attempt}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {row.city}, {row.state} {row.postalCode}
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={row.pickupStatus === 'ON_THE_WAY' ? 'grape' : 'blue'} size="sm">
                            {row.pickupStatus === 'ON_THE_WAY'
                              ? `${row.deliveryUserName} on the way`
                              : `${row.deliveryUserName} – not started`}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{formatDateTime(row.startedAt ?? row.assignedAt)}</Table.Td>
                        <Table.Td>
                          {row.pickupStatus === 'ASSIGNED' ? (
                            <AssignDriver returnId={row.returnId} current={row.deliveryUserId} label="Reassign" />
                          ) : (
                            <Text size="xs" c="dimmed">
                              With the driver
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )
          }}
        </QueryState>
      </Paper>

      <Paper withBorder radius="md" p="md" maw={640}>
        <Title order={4} mb="sm">
          Drivers
        </Title>
        <QueryState query={drivers}>
          {(rows) =>
            rows.length === 0 ? (
              <Text c="dimmed" size="sm">
                No active delivery users.
              </Text>
            ) : (
              <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                {rows.map((d) => (
                  <Group key={d.userId} justify="space-between" wrap="nowrap">
                    <div>
                      <Text size="sm" fw={500}>
                        {d.fullName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {d.userId}
                        {d.phone && <> · {d.phone}</>}
                      </Text>
                    </div>
                    <Badge variant="light" color={d.activeDeliveries > 0 ? 'blue' : 'gray'}>
                      {d.activeDeliveries} jobs in hand
                    </Badge>
                  </Group>
                ))}
              </SimpleGrid>
            )
          }
        </QueryState>
      </Paper>

      <DriverPerformance />
    </Stack>
  )
}
