import http from "http"
http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Headers", "*")
  if (req.method === "OPTIONS") return res.end()
  let body = ""
  req.on("data", (c) => (body += c))
  req.on("end", () => { console.log("LOG " + body); res.end("ok") })
}).listen(5198, () => console.log("log server on 5198"))
