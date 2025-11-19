// server.js - UPDATED
const app = require("./app");

const PORT = process.env.PORT || 5000;

// Railway needs this specific binding
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Access via: http://0.0.0.0:${PORT}`);
});
