export const maximumPendingProductChatFiles = 20

export class ProductChatFileSelection<T> {
  private pending: T[] = []

  stage(files: readonly T[]): number {
    this.pending = [...files].slice(0, maximumPendingProductChatFiles)
    return this.pending.length
  }

  take(): T[] {
    const selected = this.pending
    this.pending = []
    return selected
  }

  clear(): void {
    this.pending = []
  }
}
