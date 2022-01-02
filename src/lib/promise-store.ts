class Store {
  private promises = new Map<string, Function>()

  getPromise = (key: string) => {
    const resolve = this.promises.get(key)
    return resolve
  }

  savePromise = (key: string, resolve: Function) => {
    this.promises.set(key, resolve)
  }

  deletePromise = (key: string) => {
    this.promises.delete(key)
  }
}

export default Store
