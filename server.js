const express = require("express")
const path = require("path")

const PORT = 4000

const app = express()

app.get('/manifest.webmanifest', (req, res) => {
  res.sendFile(path.join(__dirname, 'manifest.webmanifest'), {
    headers: {
      'Content-Type': 'application/manifest+json'
    }
  });
});

app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'sw.js'), {
    headers: {
      'Content-Type': 'application/javascript'
    }
  });
});

app.use("/", express.static(__dirname))

app.listen(PORT, function () {
  console.log(`Express server listening on port ${PORT}`)
})
