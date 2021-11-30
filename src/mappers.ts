import { CurrentUser, Thread, ThreadType, Participant, Message, MessageAttachment, MessageAttachmentType } from '@textshq/platform-sdk'
import type { MeResult } from './lib/types'

export const mapCurrentUser = (user: MeResult): CurrentUser => ({
  id: `t2_${user.id}`,
  displayText: user.name,
  nickname: user.name,
  username: user.name,
  imgURL: user.icon_img,
})

const mapChannelMember = (user): Participant => ({
  id: user.user_id,
  nickname: user.nickname,
  username: user.nickname,
})

const mapSnoomoji = (data: any): MessageAttachment[] => ([{
  id: data.clientMessageId,
  srcURL: `https://www.redditstatic.com/desktop2x/img/snoomoji/${data.snoomoji}.png`,
  size: { width: 50, height: 50 },
  type: MessageAttachmentType.IMG,
}])

const mapV1Attachments = (data: any): MessageAttachment[] => {
  if (data?.snoomoji) return mapSnoomoji(data)

  if (!data?.image && !data?.gif) return []

  const { image, gif } = data
  const source = image || gif

  return [
    {
      id: source.id,
      srcURL: source.url,
      size: { width: source.width, height: source.height },
      type: MessageAttachmentType.IMG,
      isGif: Boolean(gif),
    },
  ]
}

export const mapMessage = (message: any, currentUserId: string): Message => {
  const senderID = message.user?.user_id || message.user?.guest_id
  const data = JSON.parse(message.data || '{}')

  return {
    _original: JSON.stringify(message),
    id: `${message?.message_id || message?.msg_id}`,
    timestamp: new Date(message.created_at || message.ts),
    text: message.message,
    senderID,
    isSender: currentUserId === senderID,
    editedTimestamp: message.updated_at > 0 ? new Date(message.updated_at) : undefined,
    attachments: mapV1Attachments(data?.v1 || {}) || undefined,
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
    _original: JSON.stringify(thread),
    id: thread.channel_url,
    isReadOnly: thread?.freeze,
    isUnread: thread.unread_message_count > 0,
    type,
    timestamp: lastMessage ? new Date(lastMessage.created_at) : new Date(thread.invited_at),
    participants: {
      items: thread.members.map(mapChannelMember).filter(participant => participant.id !== currentUserId),
      hasMore: false,
    },
    messages: { items: [mapMessage(lastMessage, currentUserId)], hasMore: true },
  }
}

export const mapThreads = (threads: any[], currentUserId: string): Thread[] => threads.map(thread => mapThread(thread, currentUserId))
