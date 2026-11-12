// Development only: forward /api from the React dev server to the local API server.
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: `http://localhost:${process.env.API_PORT || 3001}`,
      changeOrigin: true,
    })
  );
};
