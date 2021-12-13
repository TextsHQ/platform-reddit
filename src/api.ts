import type { LoginCreds, LoginResult, Message, MessageContent, OnServerEventCallback, Paginated, PaginationArg, PlatformAPI, Thread } from '@textshq/platform-sdk'
import { ActivityType } from '@textshq/platform-sdk'
import { CookieJar } from 'tough-cookie'

import { RedditAPI } from './lib'
import { mapCurrentUser, mapMessages, mapThreads } from './mappers'

export default class Reddit implements PlatformAPI {
  api: RedditAPI = new RedditAPI()

  private currentUser: any = null

  private currentUserId: string

  init = async (serialized: { cookies: any, apiToken: string }) => {
    const { cookies, apiToken } = serialized || {}
    if (!cookies && !apiToken) return

    const cookieJar = CookieJar.fromJSON(cookies) || null

    await this.api.init({ apiToken, cookieJar })
    await this.afterAuth()
  }

  login = async ({ cookieJarJSON }: LoginCreds): Promise<LoginResult> => {
    const cookieJar = CookieJar.fromJSON(cookieJarJSON as any)

    await this.api.init({ cookieJar })
    await this.afterAuth()

    return { type: 'success' }
  }

  afterAuth = async () => {
    const user = await this.api.getCurrentUser()
    this.currentUser = user
    this.currentUserId = `t2_${user.id}`
  }

  serializeSession = () => ({
    cookies: this.api.http.cookieJar.toJSON(),
    clientToken: this.api.apiToken,
  })

  dispose = () => null

  getCurrentUser = () => mapCurrentUser(this.currentUser)

  subscribeToEvents = async (onEvent: OnServerEventCallback): Promise<void> => {
    if (!this.currentUser) this.currentUser = await this.api.getCurrentUser()
    await this.api.connect(this.currentUser.id, onEvent)
  }

  searchUsers = async (typed: string) => {
    const res = await this.api.searchUsers(typed)
    return res
  }

  getThreads = async (): Promise<Paginated<Thread>> => {
    const res = await this.api.getThreads()
    const items = mapThreads(res?.channels || [], this.currentUserId)

    return { items, hasMore: false }
  }

  getMessages = async (threadID: string, pagination: PaginationArg): Promise<Paginated<Message>> => {
    const { cursor } = pagination || { cursor: null }

    const res = await this.api.getMessages(threadID, Number(cursor))
    const items = mapMessages(res?.messages || [], this.currentUserId)

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

  sendReadReceipt = () => null

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
