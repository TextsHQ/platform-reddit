import { CurrentUser, Thread, ThreadType, Participant, Message, MessageAttachment, MessageAttachmentType, TextEntity, MessageReaction } from '@textshq/platform-sdk'

import type { Reaction, RedditUser } from './lib/types'
import { RedditURLs, supportedReactions } from './lib/constants'
import type { InboxChild, ReplyChild } from './lib/types/inbox'
import { mapTextAttributes } from './text-attributes'

export const mapCurrentUser = (user: RedditUser): CurrentUser => ({
  id: `${user.sendbird_id || user.id}`,
  displayText: user.name,
  nickname: user.name,
  username: user.name,
  imgURL: user.icon_img,
})

export const getSendbirdId = (userId: string): string => (userId?.startsWith('t2_') ? userId : `t2_${userId}`)

export const mapChannelMember = (user): Participant => ({
  id: getSendbirdId(user.user_id || user.id),
  nickname: user.nickname || user.name,
  username: user.nickname || user.name,
})

const mapSnoomoji = (data: any): MessageAttachment[] => ([{
  id: data.clientMessageId,
  srcURL: `${RedditURLs.SNOOMOJI_STATIC}/${data.snoomoji}.png`,
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

const mapV1Entities = (data: any): TextEntity[] => {
  if (!data?.image && !data?.gif) return []

  const { image, gif } = data
  const source = image || gif

  return [{ from: 0, to: source?.url?.length, replaceWith: '' }]
}

const mapReactions = (data: Reaction[]): MessageReaction[] => {
  if (!data?.length) return []

  return data.reduce((previous: MessageReaction[], current) => {
    const reactions: MessageReaction[] = current.user_ids.map(participantID => ({
      id: `${participantID}${current.key}`,
      reactionKey: current.key,
      imgURL: supportedReactions[current.key] ? undefined : `${RedditURLs.API_I}/${current.key}`,
      participantID,
    }))

    return [...previous, ...reactions]
  }, [])
}

export const mapMessage = (message: any, currentUserId: string): Message => {
  if (!message) return

  const senderID = message.user?.user_id || message.user?.guest_id
  const data = JSON.parse(message.data || 'null')

  const attachments = mapV1Attachments(data?.v1 || {})
  const entities = mapV1Entities(data?.v1 || {})
  const reactions = mapReactions(message?.reactions || []) || undefined
  const isEdited = message.updated_at > 0 && !attachments?.length

  return {
    _original: JSON.stringify(message),
    id: `${message?.message_id || message?.msg_id}`,
    cursor: message.created_at,
    timestamp: new Date(message.created_at || message.ts),
    text: message.message,
    senderID,
    reactions,
    isSender: currentUserId === senderID,
    editedTimestamp: isEdited ? new Date(message.updated_at) : undefined,
    attachments: attachments || undefined,
    textAttributes: { entities },
  }
}

export const mapMessages = (messages: any[], currentUserId: string): Message[] =>
  messages.map(message => mapMessage(message, currentUserId))

export const mapThread = (thread: any, currentUserId: string): Thread => {
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
    messages: {
      items: [mapMessage(lastMessage, currentUserId)].filter(Boolean),
      hasMore: true,
    },
  }
}

export const mapThreads = (threads: any[], currentUserId: string): Thread[] => threads.map(thread => mapThread(thread, currentUserId))

const mapInboxThread = (thread: InboxChild, currentUserId: string): Thread => {
  if (thread.kind !== 't4') return null

  const { data } = thread
  const { replies } = thread.data

  const createdAtReplies = typeof replies === 'string' ? [] : replies.data.children.map(child => child.data.created)
  const maxCreatedAt = Math.max(data.created, ...createdAtReplies)

  return {
    id: data.id,
    title: data.subject,
    isUnread: data.new || false,
    type: 'single',
    isReadOnly: !data.author_fullname,
    timestamp: new Date(maxCreatedAt * 1000),
    createdAt: new Date(data.created * 1000),
    description: data.subject,
    messages: { items: [mapInboxMessage(thread as ReplyChild, currentUserId)], hasMore: true },
    participants: { items: data.participants?.map(mapChannelMember) || [], hasMore: true },
  }
}

export const mapInboxThreads = (threads: InboxChild[], currentUserId: string): Thread[] => threads.map(thread => mapInboxThread(thread, currentUserId))

export const mapInboxMessage = (message: ReplyChild, currentUserId: string): Message => {
  if (message.kind !== 't4') return null

  const { data } = message
  const { text, textAttributes } = mapTextAttributes(data.body)

  return {
    id: data.id,
    timestamp: new Date(data.created * 1000),
    senderID: data.author_fullname || data.author,
    isSender: data.author === currentUserId,
    text,
    textAttributes,
  }
}

export const mapInboxMessages = (messages: ReplyChild[], currentUserId: string): Message[] => messages.map(message => mapInboxMessage(message, currentUserId))
