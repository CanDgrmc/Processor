class Processor {
  retryInterval;
  queue = new Set();
  processes = new Set();
  failedProcesses = new Set();
  errors = [];
  retryCount;
  executeCount;
  
  /**
   * 
   * @param {number} retryCount 
   * @param {number} retryInterval milliseconds 
   */
  constructor(retryCount = 2, retryInterval = 500, executeCount = 10) {
    this.retryCount = retryCount;
    this.retryInterval = retryInterval;
    this.executeCount = executeCount;
  }

  addToQueue(process) {
    this.queue.add(process);
  }

  removeFromQueue(process) {
    this.queue.delete(process);
  }

  prependQueue(process) {
    const queue = Array.from(this.queue);
    queue.unshift(process);
    this.queue = new Set(queue);
  }

  async bulkProcessQueue() {
    const response = [];
    let bulkProcessGroup = [];
    let hasFailures = false;
    // processing the queue
    this.queue.forEach(async (promise) => {
      this.queue.delete(promise);
      bulkProcessGroup.push(promise);
      if (bulkProcessGroup.length % this.executeCount === 0) {
        const promiseResults = await Promise.all(bulkProcessGroup);
        response.push(...promiseResults.filter(i => i.state === 'fulfilled').map(i => i.value));
      }
    });

    if (bulkProcessGroup.length) {
      const finalPromiseResults = await Promise.all(bulkProcessGroup);
      response.push(...finalPromiseResults.filter(i => i.state === 'fulfilled').map(i => i.value));
    }

    if (hasFailures) {
      await this.retryFailed();
    }
    return response;
  }

  async processStack () {
    let response = [];
    let hasFailures = false;
    const queue = Array.from(this.queue);

    for (let i = queue.length - 1; i >= 0 ; i--) {
      const promise = queue[i];
      const result = await this.process(promise);
      if (!result) {
        hasFailures = true;
      }
      response.push(result);
      this.queue.delete(promise);
    }

    if (hasFailures) {
      await this.retryFailed();
    }

    return response;
  }
  
  async processQueue() {
    const response = [];
    let hasFailures = false;

    // processing the queue
    this.queue.forEach(async (promise) => {
      const result = await this.process(promise);
      if (!result) {
        hasFailures = true;
      }
      response.push(result);
      this.queue.delete(promise);
    });

    if (hasFailures) {
      await this.retryFailed();
    }
    return response;
  }

  async process(promise) {
    try {
      this.processes.add(promise);
      const response = await promise();
      this.processes.delete(promise);
      // if this.queue.size <= 1 run defer
      return response;
    } catch (err) {
      this.processes.delete(promise);
      this.errors.push(err);
      this.failedProcesses.add(promise);
      return false;
    }
  }


  async retryFailed() {
    if (this.failedProcesses.size === 0) {
      return;
    }

    for (let i = 0; i < this.retryCount; i++) {
      await this._wait(this.retryInterval);
      this.failedProcesses.forEach(async (func) => {
        const result = await this.process(func);
        if (result) {
          this.failedProcesses.delete(func);
        }
      });
    }
  }

  /**
   * 
   * @returns {Array | boolean} Array of failed processes
   */
  getErrors() {
    return this.errors.length ? this.errors : false;
  }


  async defer() {
    // TODO
  }

  /**
   * 
   * @param {number} ms milliseconds
   * @returns 
   */
  async _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));

  }
  
}

module.exports = Processor;