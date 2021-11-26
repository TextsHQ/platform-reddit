import type { LoginCreds, LoginResult, Message, Paginated, PaginationArg, PlatformAPI, Thread } from '@textshq/platform-sdk'
import { CookieJar } from 'tough-cookie'

import { RedditAPI } from './lib'
import { mapCurrentUser, mapMessages, mapThreads } from './mappers'

export default class Reddit implements PlatformAPI {
  api: RedditAPI = new RedditAPI()

  private currentUser: any = null

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
    await this.api.connect(user.id)
  }

  serializeSession = () => ({
    cookies: this.api.http.cookieJar.toJSON(),
    clientToken: this.api.apiToken,
  })

  dispose = () => null

  getCurrentUser = () => mapCurrentUser(this.currentUser)

  subscribeToEvents = () => null

  searchUsers = () => null

  getThreads = async (): Promise<Paginated<Thread>> => {
    const res = await this.api.getThreads()
    const items = mapThreads(res?.channels || [])

    return { items, hasMore: false }
  }

  getMessages = async (threadID: string, pagination: PaginationArg): Promise<Paginated<Message>> => {
    const { cursor } = pagination || { cursor: null }

    const res = await this.api.getMessages(threadID, cursor)
    const mappedCurrentUser = mapCurrentUser(this.currentUser)
    const items = mapMessages(res?.messages || []).map(message => ({ ...message, isSender: mappedCurrentUser.id === message.senderID }))

    return { items, hasMore: items?.length > 0 }
  }

  createThread = () => null

  sendActivityIndicator = () => null

  sendReadReceipt = () => null
}
