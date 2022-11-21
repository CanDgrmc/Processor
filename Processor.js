class Processor {
  queue = new Set();
  processes = new Set();
  failedProcesses = new Set();
  errors = [];
  retryCount = 2;
  
  /**
   * 
   * @param {number} retryCount 
   */
  constructor(retryCount = 2) {
    this.retryCount = retryCount;
  }

  addToQueue(process) {
    this.queue.add(process);
  }

  async processStack () {
    let response = [];
    let hasFailures = false;
    const queue = Array.from(this.queue);

    for (let i = queue.length - 1; i >= 0 ; i--) {
      const promise = queue[i];
      const result = await this.process(promise);
      console.log('result', result);
      if (!result) {
        hasFailures = true;
      }
      response.push(result);
      this.queue.delete(promise);
    }

    return response;
  }
  
  async processQueue() {
    const response = [];
    let hasFailures = false;

    // processing the queue
    this.queue.forEach(async (promise) => {
      const result = await this.process(promise);
      console.log('result', result);
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
      console.log('processing..');
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
      await this._wait(500);
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