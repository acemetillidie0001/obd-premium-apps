/**
 * OBD Social Auto-Poster - Image Generation Concurrency Limiter
 * 
 * Limits concurrent image generation calls to prevent overwhelming the engine.
 */

type Task<T> = () => Promise<T>;

class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<{ task: Task<unknown>; resolve: (value: unknown) => void; reject: (error: unknown) => void }> = [];
  private readonly maxConcurrent: number;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  async execute<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task: task as Task<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const { task, resolve, reject } = this.queue.shift()!;
    this.running++;

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }
}

// Global limiter: max 2 concurrent image generation calls
export const imageGenerationLimiter = new ConcurrencyLimiter(2);

