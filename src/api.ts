import type { LoginCreds, LoginResult, Message, MessageContent, OnServerEventCallback, Paginated, PaginationArg, PlatformAPI, Thread } from '@textshq/platform-sdk'
import { ActivityType } from '@textshq/platform-sdk'
import { CookieJar } from 'tough-cookie'

import type { RedditUser } from './lib/types'
import { RedditAPI } from './lib'
import { mapCurrentUser, mapInboxThreads, mapThreads } from './mappers'

export default class Reddit implements PlatformAPI {
  private readonly api = new RedditAPI()

  private currentUser: RedditUser = null

  private showInbox: boolean

  init = async (serialized: { cookies: any, apiToken: string }, _, prefs: Record<string, any>) => {
    const { cookies, apiToken } = serialized || {}
    if (!cookies && !apiToken) return

    this.showInbox = prefs?.show_inbox || false

    const cookieJar = CookieJar.fromJSON(cookies) || null
    await this.afterAuth({ apiToken, cookieJar })
  }

  login = async ({ cookieJarJSON }: LoginCreds): Promise<LoginResult> => {
    if (!cookieJarJSON?.cookies?.some(({ key }) => key === 'reddit_session')) return { type: 'error', errorMessage: 'No authentication cookie was found' }

    // this would throw on a request if the cookie is expired
    // {
    //   reason: 'Unauthorized',
    //   explanation: "{'reason': 'cookie has expired', 'accountId': 't2_ncul7', 'cookieTimeStamp': '2021-12-21 13:27:48 +0000 UTC'}"
    // }
    const cookieJar = CookieJar.fromJSON(cookieJarJSON as any)
    await this.afterAuth({ cookieJar })

    return { type: 'success' }
  }

  afterAuth = async ({ cookieJar, apiToken = undefined }: { cookieJar: CookieJar, apiToken?: string }) => {
    const user = await this.api.init({ cookieJar, apiToken, showInbox: this.showInbox })
    this.currentUser = user
  }

  serializeSession = () => ({
    cookies: this.api.http.cookieJar.toJSON(),
    clientToken: this.api.apiToken,
  })

  dispose = async () => {
    this.api.dispose()
  }

  getCurrentUser = () => mapCurrentUser(this.currentUser)

  subscribeToEvents = async (onEvent: OnServerEventCallback): Promise<void> => {
    if (!this.currentUser) this.currentUser = await this.api.getCurrentUser()
    await this.api.connect(this.currentUser.sendbird_id, onEvent)
  }

  searchUsers = async (typed: string) => {
    const res = await this.api.searchUsers(typed)
    return res
  }

  getThreads = async (): Promise<Paginated<Thread>> => {
    const res = await this.api.getThreads()
    const chatItems = mapThreads(res?.chat?.channels || [], this.currentUser.sendbird_id)
    const inboxItems = mapInboxThreads(res.inbox, this.currentUser.name) || []

    const items = [...chatItems, ...inboxItems]

    return { items, oldestCursor: res.nextInboxCursor, hasMore: !!res.nextInboxCursor }
  }

  getMessages = async (threadID: string, pagination: PaginationArg): Promise<Paginated<Message>> => {
    const { cursor } = pagination || { cursor: null }

    const items = await this.api.getMessages(threadID, Number(cursor))

    return {
      items,
      hasMore: items?.length > 0,
    }
  }

  sendMessage = async (threadID: string, content: MessageContent): Promise<Message[] | boolean> => {
    const res = await this.api.sendMessage(threadID, content)
    return res
  }

  createThread = async (userIDs: string[], title: string) => {
    const res = await this.api.createThread(userIDs, title)
    return res
  }

  sendActivityIndicator = async (type: ActivityType, threadID: string) => {
    if (type === ActivityType.TYPING) await this.api.sendTyping(threadID)
  }

  sendReadReceipt = async (threadID: string) => {
    await this.api.sendReadReceipt(threadID)
  }

  deleteThread = async (threadID: string) => {
    await this.api.deleteThread(threadID)
  }

  deleteMessage = async (threadID: string, messageID: string) => {
    await this.api.deleteMessage(threadID, messageID)
    return true
  }

  addReaction = this.api.addReaction

  removeReaction = this.api.removeReaction
}
