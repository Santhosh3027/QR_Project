const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
const connectdb = require('./config/QRconfig');
const router = require('./routes/QRroutes');
const dotenv = require('dotenv')
dotenv.config()
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
connectdb()

app.use('/',router)

app.listen(port, () => {
  console.log(`QR server running at http://localhost:${port}`);
});
