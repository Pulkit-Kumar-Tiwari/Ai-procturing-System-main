const app = require("../server");

module.exports = (req, res) => {
  const requestUrl = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const apiPath = requestUrl.searchParams.get("path");
  if (!apiPath) return res.status(404).json({ error: "API route not found." });

  requestUrl.searchParams.delete("path");
  req.url = `/api/${apiPath}${requestUrl.search}`;
  app(req, res);
};
