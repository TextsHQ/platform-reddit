import { OnServerEventCallback, ServerEvent, ServerEventType } from '@textshq/platform-sdk'
import type { InboxResponse, ReplyChild } from '../types/inbox'
import type Http from '../http'

import { mapInboxMessage } from '../../mappers'
import { RedditURLs } from '../constants'

class RealTime {
  private interval: NodeJS.Timer

  private unreadIDs: string[] = []

  private userId: string

  constructor(
    readonly onEvent: OnServerEventCallback,
    readonly http: Http,
    readonly apiToken: string,
  ) {}

  checkMessages = async () => {
    const url = `${RedditURLs.HOME_WITH_SESSION}/message/unread.json`
    const res: InboxResponse = await this.http.get(url)

    const newMessages = (res.data || { children: [] }).children.filter(child => !this.unreadIDs.includes(child.data.name) && !!child.data.parent_id)
    this.unreadIDs = [...this.unreadIDs, ...newMessages.map(child => child.data.name)]

    const events: ServerEvent[] = newMessages.map(message => ({
      type: ServerEventType.STATE_SYNC,
      objectIDs: { threadID: (message.data.parent_id as string)?.slice(3) },
      objectName: 'message',
      mutationType: 'upsert',
      entries: [mapInboxMessage(message as ReplyChild, this.userId)],
    }))

    if (!events.length) return

    this.onEvent(events)
  }

  connect = async (userId: string) => {
    this.userId = userId

    const url = `${RedditURLs.HOME_WITH_SESSION}/message/unread.json`
    const res: InboxResponse = await this.http.get(url)

    const initialIDs = (res.data || { children: [] }).children.map(child => child.data.name)

    this.unreadIDs = initialIDs

    clearInterval(this.interval)
    this.interval = setInterval(this.checkMessages, 5_000)
  }

  dispose = () => {
    clearInterval(this.interval)
  }
}

export default RealTime
