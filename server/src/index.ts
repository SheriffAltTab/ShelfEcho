import { env } from './config/env.js';
import { createApp } from './app.js';

const app = createApp({ scheduleQuotes: true });
app.listen(env.port, env.bindHost, () => {
  console.log(`ShelfEcho server running on http://${env.bindHost}:${env.port}`);
});
