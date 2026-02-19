import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();


// Enable CORS for all routes
app.use(
  '*',
  cors({
    credentials: true,
    origin: (origin) => origin || '*',
  })
);

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

export default {
  fetch: app.fetch,
  port: 3002,
};
