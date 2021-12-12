import { Message, MessageContent, OnServerEventCallback, ServerEventType, texts } from '@textshq/platform-sdk/'
import { v4 as uuid } from 'uuid'
import WebSocket from 'ws'

import type Store from './store'
import { SENDBIRD_KEY, SENDBIRD_USER_AGENT, USER_AGENT } from './constants'
import { mapMessage } from '../mappers'

class RealTime {
  store: Store

  private ws?: WebSocket

  sessionKey: string

  reqId: number = new Date().getTime()

  onEvent: OnServerEventCallback

  userId: string

  url: string

  sendMessageResolvers = new Map<string, Function>()

  pingInterval: any

  safeDisconnect: boolean

  constructor(onEvent: OnServerEventCallback, store: Store) {
    this.onEvent = onEvent
    this.store = store
  }

  getWsUrl = (userId: string, apiToken: string): string => {
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
    const payload = `PING{id: ${new Date().getTime()}, active: 1, req_id: ""}\n`
    this.ws.ping(payload)
  }

  private setupHandlers = () => {
    this.ws.on('open', () => texts.log('WS Client connected'))

    this.ws.on('error', error => {
      texts.log('WS Client error', error)
    })

    this.ws.onclose = () => {
      if (this.safeDisconnect) {
        this.ws.terminate()
        clearInterval(this.pingInterval)
      } else {
        texts.log('WS Client Disconnected, will reconnect')
        this.setupClient()
      }
    }

    this.ws.on('pong', () => console.log('PONG'))
    this.ws.onmessage = this.onMessage
    this.pingInterval = setInterval(this.heartbeat, 7000)
  }

  onMessage = (message: WebSocket.MessageEvent) => {
    try {
      // Structure:
      // IDEN:data
      // Example: LOGI{"key":"blablabla"}
      const dataString = (message.data as string).slice(4)
      // FIXME: add more cases
      const data = JSON.parse(dataString || '{}')
      const type = message.data.slice(0, 4)
      // TODO: Use types
      if (type === 'LOGI') this.handleLOGIEvent(data)
      if (type === 'MESG' || type === 'MEDI') this.handleMESGEvent(data)
    } catch (error) {
      texts.log('Error handling message', error, { data: message.data })
    }
  }

  handleLOGIEvent = (data: Record<string, any>) => {
    this.sessionKey = data.key
  }

  handleMESGEvent = (data: Record<string, any>) => {
    const messageData = JSON.parse(data?.data || '{}')
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
      const payload = `MESG{"channel_url":"${threadID}","message":"${content.text.replace(/\n/g, '\\n')}","data":"{\\"v1\\":{\\"clientMessageId\\":\\"${clientMessageId}\\",\\"preview_collapsed\\":false,\\"embed_data\\":{},\\"hidden\\":false,\\"highlights\\":[]}}","mention_type":"users","req_id":"${this.reqId}"}\n`

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
    const time = new Date().getTime()
    const payload = `TPST{{"channel_url":"${threadID}","time":${time},"req_id":""}}\n`
    this.ws.send(payload)
  }
}

export default RealTime
