import type { CurrentUser, Thread, ThreadType, Participant, Message } from '@textshq/platform-sdk'
import type { MeResult } from './lib/types'

export const mapCurrentUser = (user: MeResult): CurrentUser => ({
  id: `t2_${user.id}`,
  displayText: user.name,
  imgURL: user.icon_img,
})

const mapChannelMember = (user): Participant => ({
  id: user.user_id,
  nickname: user.nickname,
  username: user.nickname,
})

export const mapMessage = (message: any, currentUserId: string): Message => {
  const senderID = message.user?.user_id || message.user?.guest_id

  return {
    id: `${message?.message_id || message?.msg_id}`,
    timestamp: new Date(message.created_at || message.ts),
    text: message.message,
    senderID,
    isSender: currentUserId === senderID,
    editedTimestamp: message.updated_at > 0 ? new Date(message.updated_at) : undefined,
  }
}

export const mapMessages = (messages: any[], currentUserId: string): Message[] => messages.map(message => mapMessage(message, currentUserId))

const mapThread = (thread: any, currentUserId: string): Thread => {
  const type: ThreadType = (() => {
    if (thread.is_broadcast) return 'broadcast'
    if (thread.channel?.member_count > 2) return 'channel'

    return 'single'
  })()

  const { last_message: lastMessage } = thread

  return {
    id: thread.channel_url,
    isReadOnly: thread?.freeze,
    isUnread: thread.unread_message_count > 0,
    type,
    timestamp: lastMessage ? new Date(lastMessage.created_at) : new Date(thread.invited_at),
    participants: { items: thread.members.map(mapChannelMember), hasMore: false },
    messages: { items: [mapMessage(lastMessage, currentUserId)], hasMore: true },
  }
}

export const mapThreads = (threads: any[], currentUserId: string): Thread[] => threads.map(thread => mapThread(thread, currentUserId))
