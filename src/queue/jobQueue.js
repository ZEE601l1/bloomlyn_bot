/**
 * Bloomlyn Custom Job Queue
 * In-memory sequential queue for processing heavy tasks
 * (AI compositing, channel notifications)
 */

class JobQueue {
  constructor(name, concurrency = 1) {
    this.name = name;
    this.concurrency = concurrency;
    this.queue = [];
    this.running = 0;
    this.processed = 0;
    this.failed = 0;
  }

  /**
   * Add a job to the queue
   * @param {Function} jobFn - Async function to execute
   * @param {object} metadata - Optional metadata for logging
   * @returns {Promise} Resolves when job completes
   */
  add(jobFn, metadata = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({ jobFn, metadata, resolve, reject });
      this._processNext();
    });
  }

  /**
   * Add a job without waiting for completion (fire-and-forget)
   * @param {Function} jobFn - Async function to execute
   * @param {object} metadata - Optional metadata for logging
   */
  enqueue(jobFn, metadata = {}) {
    this.queue.push({
      jobFn,
      metadata,
      resolve: () => {},
      reject: (err) => console.error(`❌ [${this.name}] Job failed:`, err.message),
    });
    this._processNext();
  }

  async _processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;

    this.running++;
    const { jobFn, metadata, resolve, reject } = this.queue.shift();

    try {
      console.log(`▶️  [${this.name}] Processing job: ${metadata.name || 'unnamed'}`);
      const result = await jobFn();
      this.processed++;
      console.log(`✅ [${this.name}] Job completed: ${metadata.name || 'unnamed'}`);
      resolve(result);
    } catch (error) {
      this.failed++;
      console.error(`❌ [${this.name}] Job failed: ${metadata.name || 'unnamed'} – ${error.message}`);
      reject(error);
    } finally {
      this.running--;
      this._processNext();
    }
  }

  /**
   * Get queue statistics
   */
  stats() {
    return {
      name: this.name,
      pending: this.queue.length,
      running: this.running,
      processed: this.processed,
      failed: this.failed,
    };
  }
}

// Singleton queues
export const imageQueue = new JobQueue('image-compositor', 1);
export const notificationQueue = new JobQueue('notification-system', 1);

const defaultQueue = new JobQueue('main-pipeline', 1);
export default defaultQueue;
