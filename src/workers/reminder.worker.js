class ReminderWorker {
  constructor(deadlineService, deliveryService) {
    this.deadlines = deadlineService;
    this.deliveries = deliveryService;
    this.timer = null;
    this.running = null;
  }
  tick() {
    if (this.running) return this.running;
    this.running = (async () => {
      await this.deadlines.processEscalationReminders();
      await this.deliveries.processDue();
    })().finally(() => { this.running = null; });
    return this.running;
  }
  start() {
    const run = () => this.tick().catch(error => console.error('[Reminder worker]', error.code || 'WORKER_ERROR'));
    run();
    this.timer = setInterval(run, 30000);
    this.timer.unref();
  }
  async stop() {
    clearInterval(this.timer);
    if (this.running) await this.running.catch(() => {});
  }
}
module.exports = { ReminderWorker };
