type FifoNode<T> = {
  value: T;
  next: FifoNode<T> | null;
};

/**
 * A memory-efficient FIFO queue that can be used to store a fixed number of items.
 *
 * When the queue reaches its maximum size, adding a new item will remove the oldest item.
 *
 * Adding & removing items is always O(1) time complexity,
 * and the queue does not require any memory reallocation,
 * or shifting of items when adding or removing items.
 */
export class FiFo<T> implements Iterable<T> {
  private _head: FifoNode<T> | null = null;
  private _tail: FifoNode<T> | null = null;
  private _size = 0;

  constructor(private readonly maxSize: number) {
    if (maxSize <= 0) {
      throw new Error('maxSize must be greater than 0');
    }
  }

  /**
   * Adds an item to the queue.
   * If the queue is full, the oldest item will be removed.
   */
  enqueue = (item: T): void => {
    const node: FifoNode<T> = { value: item, next: null };

    if (this._size === this.maxSize) {
      // Remove the oldest item
      if (this._head) {
        this._head = this._head.next;
      }
      this._size--;
    }

    if (!this._tail) {
      this._head = node;
      this._tail = node;
    } else {
      this._tail.next = node;
      this._tail = node;
    }

    this._size++;
  };

  /**
   * Removes and returns the oldest item from the queue.
   * Returns null if the queue is empty.
   */
  dequeue = (): T | null => {
    if (!this._head) {
      return null;
    }

    const value = this._head.value;
    this._head = this._head.next;
    this._size--;
    if (this._size === 0) {
      this._tail = null;
    }
    return value;
  };

  size = (): number => {
    return this._size;
  };

  isEmpty = (): boolean => {
    return this._size === 0;
  };

  [Symbol.iterator](): Iterator<T> {
    let current = this._head;
    return {
      next: (): IteratorResult<T> => {
        if (current) {
          const value = current.value;
          current = current.next;
          return { value, done: false };
        } else {
          return { value: undefined, done: true };
        }
      },
    };
  }

  /**
   * Returns an iterable that filters the items in the queue based on the
   * provided predicate function.
   *
   * Used for memory-efficient iteration of the queue without requiring any new
   * heap allocations or copying of the queue items.
   */
  filterIterator = (predicate: (item: T) => boolean): Iterable<T> => {
    const getNextNode = (node: FifoNode<T> | null): FifoNode<T> | null => {
      while (node) {
        if (predicate(node.value)) {
          return node;
        }
        node = node.next;
      }
      return null;
    };

    return {
      [Symbol.iterator]: () => {
        let current = getNextNode(this._head);
        return {
          next: (): IteratorResult<T> => {
            if (current) {
              const value = current.value;
              current = getNextNode(current.next);
              return { value, done: false };
            } else {
              return { value: undefined, done: true };
            }
          },
        };
      },
    };
  };

  head = (): T | null => {
    return this._head ? this._head.value : null;
  };

  tail = (): T | null => {
    return this._tail ? this._tail.value : null;
  };
}
