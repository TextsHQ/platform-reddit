import WebSocket from 'ws'
import { SENDBIRD_KEY, SENDBIRD_USER_AGENT, USER_AGENT } from './constants'

class RealTime {
  private ws?: WebSocket

  sessionKey: string

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

    const url = this.getWsUrl(userId, apiToken)
    this.ws = new WebSocket(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' },
    })

    this.setupHandlers()
  }

  private setupHandlers = () => {
    this.ws.on('open', async () => {
      console.log('HELLO CONNECTED')
    })

    this.ws.on('error', error => console.log('EEERRORRRR', error))

    this.ws.onmessage = this.onMessage
  }

  onMessage = (message: WebSocket.MessageEvent) => {
    // Structure:
    // IDEN:data
    // Example: LOGI{"key":"blablabla"}
    const dataString = (message.data as string).slice(4)
    // FIXME: add more cases
    const data = JSON.parse(dataString)
    const type = message.data.slice(0, 4)
    // TODO: Use types
    if (type === 'LOGI') this.handleLOGIMessage(data)
  }

  handleLOGIMessage = (data: Record<string, any>) => {
    this.sessionKey = data.key
  }
}

export default RealTime
