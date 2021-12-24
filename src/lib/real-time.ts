import { Message, MessageContent, OnServerEventCallback, ServerEventType, texts } from '@textshq/platform-sdk'
import { v4 as uuid } from 'uuid'
import WebSocket from 'ws'

import type Store from './store'
import { SENDBIRD_KEY, SENDBIRD_USER_AGENT, USER_AGENT } from './constants'
import { mapMessage } from '../mappers'

class RealTime {
  store: Store

  private ws?: WebSocket

  sessionKey: string

  private reqId = Date.now()

  onEvent: OnServerEventCallback

  userId: string

  url: string

  private sendMessageResolvers = new Map<string, Function>()

  pingInterval: any

  safeDisconnect: boolean

  constructor(onEvent: OnServerEventCallback, store: Store) {
    this.onEvent = onEvent
    this.store = store
  }

  getWsUrl = (userId: string, apiToken: string): string => {
    // @see https://github.com/scrubjay55/Reddit_ChatBot_Python/blob/master/Reddit_ChatBot_Python/_utils/consts.py#L1-L11
    const base = 'wss://sendbirdproxyk8s.chat.redditmedia.com'
    const params = {
      user_id: `t2_${userId}`,
      access_token: apiToken,
      p: 'Android',
      pv: '30',
      sv: '3.0.144',
      ai: SENDBIRD_KEY,
      'SB-User-Agent': SENDBIRD_USER_AGENT,
      active: '1',
    }

    return `${base}/?${new URLSearchParams(params).toString()}`
  }

  connect = async ({ userId, apiToken }) => {
    if (this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.OPEN) return

    this.userId = `t2_${userId}`
    this.url = this.getWsUrl(userId, apiToken)

    this.setupClient()
  }

  setupClient = () => {
    this.ws = new WebSocket(this.url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Encoding': 'gzip',
      },
    })

    this.setupHandlers()
  }

  heartbeat = () => {
    const time = Date.now()
    const data = { id: time, active: 1, req_id: '' }
    const payload = `PING${JSON.stringify(data)}\n`
    this.ws.ping(payload)
  }

  private setupHandlers = () => {
    this.ws.on('open', () => texts.log('WS Client connected'))

    this.ws.on('error', error => {
      texts.log('WS Client error', error)
    })

    this.ws.onclose = () => {
      if (this.safeDisconnect) {
        texts.log('WS Client safe disconnected')
        this.ws.terminate()
        this.ws = null
        clearInterval(this.pingInterval)
      } else {
        texts.log('WS Client Disconnected, will reconnect')
        this.setupClient()
      }
    }

    this.ws.onmessage = this.onMessage
    this.pingInterval = setInterval(this.heartbeat, 7000)
  }

  dispose = async () => {
    this.safeDisconnect = true
    this.ws.close()
  }

  onMessage = (message: WebSocket.MessageEvent) => {
    try {
      // Structure:
      // IDEN:data
      // Example: LOGI{"key":"blablabla"}
      const dataString = (message.data as string).slice(4)
      // FIXME: add more cases
      const data = JSON.parse(dataString || 'null')
      const type = message.data.slice(0, 4)
      // TODO: Use types
      if (type === 'LOGI') this.handleLOGIEvent(data)
      if (type === 'MESG' || type === 'MEDI') this.handleMESGEvent(data)
      if (type === 'READ') this.handleREADEvent(data)
    } catch (error) {
      texts.log('Error handling message', error, { data: message.data })
      texts.Sentry.captureException(error)
    }
  }

  handleLOGIEvent = (data: Record<string, any>) => {
    this.sessionKey = data.key
  }

  handleREADEvent = (data: Record<string, any>) => {
    const resolve = this.sendMessageResolvers.get(data.req_id)

    if (resolve) {
      this.sendMessageResolvers.delete(data.req_id)
      resolve()
    }
  }

  handleMESGEvent = (data: Record<string, any>) => {
    const messageData = JSON.parse(data?.data || 'null')
    const messageId = messageData?.v1?.clientMessageId || '-'
    const resolve = this.sendMessageResolvers.get(messageId) || this.store.getPromise(messageId)

    if (resolve) {
      this.sendMessageResolvers.delete(data?.request_id)
      this.store.deletePromise(messageData?.v1?.clientMessageId)

      resolve([mapMessage(data, this.userId)])
      return true
    }

    this.onEvent([{
      type: ServerEventType.STATE_SYNC,
      objectIDs: { threadID: data?.channel_url },
      objectName: 'message',
      mutationType: 'upsert',
      entries: [mapMessage(data, this.userId)],
    }])
  }

  sendMessage = async (threadID: string, content: MessageContent): Promise<Message[]> => {
    if (!content.text) return []

    const promise = new Promise<any>((resolve, reject) => {
      const clientMessageId = uuid()

      const data = JSON.stringify({
        channel_url: threadID,
        message: content.text,
        data: JSON.stringify({
          v1: {
            clientMessageId,
            preview_collapsed: false,
            embed_data: {},
            hidden: false,
            highlights: [],
          },
        }),
        mention_type: 'users',
        req_id: this.reqId,
      })
      const payload = `MESG${data}\n`

      this.ws.send(payload, error => {
        if (error) {
          texts.log('Error sending message', error)
          return reject(error.message)
        }

        this.sendMessageResolvers.set(clientMessageId, resolve)
      })

      this.reqId += 1
    })

    return promise
  }

  sendTyping = async (threadID: string) => {
    const time = Date.now()
    const data = JSON.stringify({
      channel_url: threadID,
      time,
      req_id: '',
    })

    const payload = `TPST${data}\n`
    this.ws.send(payload)
  }

  sendReadReceipt = async (threadID: string): Promise<void> => {
    const time = Date.now()
    const data = JSON.stringify({
      channel_url: threadID,
      req_id: `${time}`,
    })

    const promise = new Promise<any>((resolve, reject) => {
      this.ws.send(`TPEN${data}\n`)
      const payload = `READ${data}\n`

      this.ws.send(payload, error => {
        if (error) {
          texts.log('Error sending message', error)
          return reject(error.message)
        }

        this.sendMessageResolvers.set(`${time}`, resolve)
      })
    })

    return promise
  }
}

export default RealTime
