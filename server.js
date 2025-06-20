const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/handshake', (req, res) => {
  res.json({
    name: 'Komi Warframe',
    handshake: true,
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
