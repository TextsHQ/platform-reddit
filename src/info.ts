import { PlatformInfo, MessageDeletionMode, Attribute } from '@textshq/platform-sdk'
import { supportedReactions } from './lib/constants'

const icon = `
<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="16" height="16" rx="5" fill="#FF4500"/>
<path d="M14 7.95167C14 7.22408 13.4095 6.63357 12.6819 6.63357C12.3234 6.63357 12.007 6.77065 11.775 7.00264C10.8787 6.3594 9.63445 5.93761 8.26362 5.88489L8.86467 3.06942L10.8155 3.48067C10.8366 3.97627 11.2478 4.37698 11.754 4.37698C12.2707 4.37698 12.6924 3.95519 12.6924 3.43849C12.6924 2.92179 12.2707 2.5 11.754 2.5C11.3849 2.5 11.0685 2.7109 10.9209 3.02724L8.73814 2.56327C8.67487 2.55272 8.6116 2.56327 8.55888 2.5949C8.50615 2.62654 8.47452 2.67926 8.45343 2.74253L7.7891 5.88489C6.38664 5.92707 5.13181 6.33831 4.22496 7.00264C3.99297 6.78119 3.66608 6.63357 3.3181 6.63357C2.59051 6.63357 2 7.22408 2 7.95167C2 8.48945 2.31634 8.94288 2.78032 9.15378C2.75923 9.28032 2.74868 9.4174 2.74868 9.55448C2.74868 11.5791 5.10018 13.2135 8.01055 13.2135C10.9209 13.2135 13.2724 11.5791 13.2724 9.55448C13.2724 9.4174 13.2619 9.29086 13.2408 9.16432C13.6731 8.95343 14 8.48945 14 7.95167ZM4.98418 8.89016C4.98418 8.37346 5.40598 7.95167 5.92267 7.95167C6.43937 7.95167 6.86116 8.37346 6.86116 8.89016C6.86116 9.40685 6.43937 9.82865 5.92267 9.82865C5.40598 9.82865 4.98418 9.40685 4.98418 8.89016ZM10.225 11.3682C9.58172 12.0114 8.35852 12.0536 8 12.0536C7.64148 12.0536 6.40773 12.0009 5.77504 11.3682C5.68014 11.2733 5.68014 11.1151 5.77504 11.0202C5.86995 10.9253 6.02812 10.9253 6.12302 11.0202C6.52373 11.4209 7.3884 11.5685 8.01055 11.5685C8.63269 11.5685 9.48682 11.4209 9.89807 11.0202C9.99297 10.9253 10.1511 10.9253 10.246 11.0202C10.3199 11.1257 10.3199 11.2733 10.225 11.3682ZM10.0562 9.82865C9.53954 9.82865 9.11775 9.40685 9.11775 8.89016C9.11775 8.37346 9.53954 7.95167 10.0562 7.95167C10.5729 7.95167 10.9947 8.37346 10.9947 8.89016C10.9947 9.40685 10.5729 9.82865 10.0562 9.82865Z" fill="white"/>
</svg>
`

const info: PlatformInfo = {
  name: 'reddit',
  version: '2022.03.01',
  displayName: 'Reddit',
  typingDurationMs: 3000,
  icon,
  loginMode: 'browser',
  browserLogin: {
    loginURL: 'https://reddit.com/login',
    authCookieName: 'reddit_session',
  },
  deletionMode: MessageDeletionMode.DELETE_FOR_EVERYONE,
  attributes: new Set([
    Attribute.SUPPORTS_DELETE_THREAD,
    Attribute.SORT_MESSAGES_ON_PUSH,
  ]),
  reactions: {
    supported: supportedReactions,
    canReactWithAllEmojis: false,
    allowsMultipleReactionsToSingleMessage: true,
  },
  prefs: {
    show_inbox: {
      label: 'Show inbox',
      type: 'checkbox',
      default: false,
    },
  },
  notifications: {
    web: {
      vapidKey: 'BJ2nJR9HeBwCWe4s7bKfKgWZkx2Q8Q59yBdSVLxWIhPaWuzHDUxQ2YJnhLvbAVujWBZYuQv60V6a6oipSw09FT0',
    },
  },
  attachments: {
    noSupportForFiles: true,
    noSupportForAudio: true,
    maxSize: {
      // Assuming Reddit has Sendbird's enterprise plan
      // @see https://help.sendbird.com/s/article/What-s-the-maximum-file-size-I-can-send-from-clients
      // @see https://www.reddit.com/r/changelog/comments/4kuk2j/reddit_change_introducing_image_uploading_beta/
      image: 20 * 1024 * 1024,
      video: 100 * 1024 * 1024,
    },
  },
}

export default info
