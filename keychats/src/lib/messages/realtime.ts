export type RealtimeMessageRow = {
  id: number
  channel_id: string | null
  dm_thread_id: string | null
  sender_id: string
  body: string | null
  reply_to_id: number | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

type MessageRealtimeChannel = {
  on: (
    type: 'postgres_changes',
    options: {
      event: 'INSERT' | 'UPDATE'
      schema: 'public'
      table: 'messages'
      filter: string
    },
    callback: (payload: { new: RealtimeMessageRow }) => void,
  ) => MessageRealtimeChannel
  subscribe: () => MessageRealtimeChannel
}

type MessageRealtimeClient = {
  channel: (name: string) => MessageRealtimeChannel
  removeChannel: (channel: MessageRealtimeChannel) => unknown
}

export function reconcileMessageChange(
  current: RealtimeMessageRow[],
  incoming: RealtimeMessageRow,
): RealtimeMessageRow[] {
  return [...current.filter((message) => message.id !== incoming.id), incoming].sort(
    (left, right) => left.id - right.id,
  )
}

function subscribeToMessages(
  client: MessageRealtimeClient,
  subscriptionName: string,
  filter: string,
  onChange: (message: RealtimeMessageRow) => void,
) {
  const channel = client
    .channel(subscriptionName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter,
      },
      (payload) => onChange(payload.new),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter,
      },
      (payload) => onChange(payload.new),
    )
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}

export function subscribeToChannelMessages(
  client: MessageRealtimeClient,
  channelId: string,
  onChange: (message: RealtimeMessageRow) => void,
) {
  return subscribeToMessages(
    client,
    `messages:channel:${channelId}`,
    `channel_id=eq.${channelId}`,
    onChange,
  )
}

export function subscribeToDmMessages(
  client: MessageRealtimeClient,
  dmThreadId: string,
  onChange: (message: RealtimeMessageRow) => void,
) {
  return subscribeToMessages(
    client,
    `messages:dm:${dmThreadId}`,
    `dm_thread_id=eq.${dmThreadId}`,
    onChange,
  )
}
