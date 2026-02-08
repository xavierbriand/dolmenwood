import { RandomProvider } from '../ports/RandomProvider.js';

export interface WeightedItem<T> {
  weight: number;
  value: T;
}

export class TableRoller {
  constructor(private random: RandomProvider) {}

  /**
   * Selects an item from the list based on its weight.
   * @param items Array of weighted items.
   * @returns The selected item's value.
   * @throws Error if the items array is empty.
   */
  rollWeighted<T>(items: WeightedItem<T>[]): T {
    if (items.length === 0) {
      throw new Error('Cannot roll on an empty table.');
    }

    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    
    // Generate a random number between 0 (inclusive) and totalWeight (exclusive)
    const roll = this.random.next() * totalWeight;
    
    let currentWeight = 0;
    for (const item of items) {
      currentWeight += item.weight;
      if (roll < currentWeight) {
        return item.value;
      }
    }
    
    // Fallback in case of floating point rounding errors (should be rare/impossible if logic is sound)
    // Return the last item.
    return items[items.length - 1].value;
  }
}
