export interface RandomProvider {
  /**
   * Returns a number between 0 (inclusive) and 1 (exclusive).
   * Equivalent to Math.random().
   */
  next(): number;
}

export class DefaultRandomProvider implements RandomProvider {
  next(): number {
    return Math.random();
  }
}
