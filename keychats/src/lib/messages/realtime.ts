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

export function subscribeToChannelMessages(
  client: MessageRealtimeClient,
  channelId: string,
  onChange: (message: RealtimeMessageRow) => void,
) {
  const channel = client
    .channel(`messages:channel:${channelId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => onChange(payload.new),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => onChange(payload.new),
    )
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}
