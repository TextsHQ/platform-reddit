import { OnServerEventCallback, ServerEvent, ServerEventType } from '@textshq/platform-sdk'
import type { InboxResponse, ReplyChild } from '../types/inbox'
import type Http from '../http'

import { mapInboxMessage } from '../../mappers'
import { RedditURLs } from '../constants'

class RealTime {
  interval: any

  private unreadedIDs: string[] = []

  private userId: string

  constructor(
    readonly onEvent: OnServerEventCallback,
    readonly http: Http,
    readonly apiToken: string,
  ) {}

  checkMessages = async () => {
    const url = `${RedditURLs.HOME}/message/unread.json`
    const res: InboxResponse = await this.http.get(url)

    const newMessages = res.data.children.filter(child => !this.unreadedIDs.includes(child.data.name) && !!child.data.parent_id)
    this.unreadedIDs = [...this.unreadedIDs, ...newMessages.map(child => child.data.name)]

    const events: ServerEvent[] = newMessages.map(message => ({
      type: ServerEventType.STATE_SYNC,
      objectIDs: { threadID: (message.data.parent_id as string)?.slice(3) },
      objectName: 'message',
      mutationType: 'upsert',
      entries: [mapInboxMessage(message as ReplyChild, this.userId)],
    }))

    this.onEvent(events)
  }

  connect = async (userId: string) => {
    this.userId = userId

    const url = `${RedditURLs.HOME}/message/unread.json`
    const res: InboxResponse = await this.http.get(url)

    const initialIDs = res.data.children.map(child => child.data.name)

    this.unreadedIDs = initialIDs
    this.interval = setInterval(this.checkMessages, 5000)
  }

  disconnect = () => {
    clearInterval(this.interval)
  }
}

export default RealTime
