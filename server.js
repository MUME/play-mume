const express = require("express")
const path = require("path")

const PORT = 4000

const app = express()

app.use("/", express.static(__dirname))

app.listen(PORT, function () {
  console.log(`Express server listening on port ${PORT}`)
})
