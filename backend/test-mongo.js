const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/VEloop').then(() => {
  console.log('Topology type:', mongoose.connection.client.topology.s.description.type);
  process.exit(0);
});
