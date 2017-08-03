// database configuration
module.exports = function(app, credentials) {
  var mongoose = require('mongoose');
  mongoose.set('debug, true');
  var options = {
    server: {
      socketOptions: {
        keepAlive: 1
      }
    }
  };

  switch (app.get('env')) {
    case 'development':
      mongoose.connect(credentials.mongo.development.connectionString, options);
      break;
    case 'production':
      mongoose.connect(credentials.mongo.production.connectionString, options);
      break;
    default:
      throw new Error('Unknown execution environment: ' + app.get('env'));
  }

  var conn = mongoose.connection;

  conn.on('connection', console.error.bind(console, 'connecting: '));

  return mongoose;
};
