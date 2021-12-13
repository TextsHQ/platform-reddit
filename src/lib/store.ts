class Store {
  promises = new Map<string, Function>()

  lastMessageCursors = new Map<string, number>()

  getPromise = (key: string) => {
    const resolve = this.promises.get(key)
    return resolve
  }

  savePromise = (key: string, resolve) => {
    this.promises.set(key, resolve)
  }

  deletePromise = (key: string) => {
    this.promises.delete(key)
  }
}

export default Store
