var express = require('express');
var app = express();
app.set('port', process.env.PORT || 3000);

// Установка механизма представления handlebars
var handlebars = require('express-handlebars')
  .create({
    defaultLayout: 'main',
    helpers: {
      section: function(name, options) {
        if (!this._sections) this._sections = {};
        this._sections[name] = options.fn(this);
        return null;
      }
    }
  });
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
/////////////

var fortune = require('./lib/fortune.js');
var weather = require('./lib/weather.js');
var formidable = require('formidable');
var jqupload = require('jquery-file-upload-middleware');
var credentials = require('./credentials.js');
var VALID_EMAIL_REGEX = new RegExp('^[a-zA-Z0-9.!#$%&\'*+\/=?^_`{|}~-]+@' +
  '[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?' +
  '(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$');
var emailService = require('./lib/email.js')(credentials);
var fs = require('fs');
var mongoose = require('./lib/mg.js')(app, credentials);
var Vacation = require('./models/vacation.js')(mongoose);

// initialize vacations
Vacation.find(function(err, vacations) {
  if (vacations.length) return;

  new Vacation({
    name: 'Hood River Day Trip',
    slug: 'hood-river-day-trip',
    category: 'Day Trip',
    sku: 'HR199',
    description: 'Spend a day sailing on the Columbia and ' +
      'enjoying craft beers in Hood River!',
    priceInCents: 9995,
    tags: ['day trip', 'hood river', 'sailing', 'windsurfing', 'breweries'],
    inSeason: true,
    maximumGuests: 16,
    available: true,
    packagesSold: 0,
  }).save();

  new Vacation({
    name: 'Oregon Coast Getaway',
    slug: 'oregon-coast-getaway',
    category: 'Weekend Getaway',
    sku: 'OC39',
    description: 'Enjoy the ocean air and quaint coastal towns!',
    priceInCents: 269995,
    tags: ['weekend getaway', 'oregon coast', 'beachcombing'],
    inSeason: false,
    maximumGuests: 8,
    available: true,
    packagesSold: 0,
  }).save();

  new Vacation({
    name: 'Rock Climbing in Bend',
    slug: 'rock-climbing-in-bend',
    category: 'Adventure',
    sku: 'B99',
    description: 'Experience the thrill of rock climbing in the high desert.',
    priceInCents: 289995,
    tags: ['weekend getaway', 'bend', 'high desert', 'rock climbing', 'hiking', 'skiing'],
    inSeason: true,
    requiresWaiver: true,
    maximumGuests: 4,
    available: false,
    packagesSold: 0,
    notes: 'The tour guide is currently recovering from a skiing accident.',
  }).save();
});

// Middleware
app.use(express.static(__dirname + '/public'));

app.use(function(req, res, next) {
  res.locals.showTests = app.get('env') !== 'production' &&
    req.query.test === '1';
  next();
});

app.use(function(req, res, next) {
  if (!res.locals.partials) res.locals.partials = {};
  res.locals.partials.weatherContext = weather.getWeatherData();
  next();
});

app.use(require('body-parser').urlencoded({
  extended: true
}));

app.use(require('cookie-parser')(credentials.cookieSecret));

app.use(require('express-session')({
  resave: false,
  saveUninitialized: false,
  secret: credentials.cookieSecret,
}));

app.use(function(req, res, next) {
  // Если имеется экстренное сообщение,
  // переместим его в контекст, а затем удалим
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

switch (app.get('env')) {
  case 'development':
    // сжатое многоцветное журналирование для
    // разработки
    app.use(require('morgan')('dev'));
    break;
  case 'production':
    // модуль 'express-logger' поддерживает ежедневное
    // чередование файлов журналов
    app.use(require('express-logger')({
      path: __dirname + '/log/requests.log'
    }));
    break;
}

app.use(function(req, res, next) {
  var cluster = require('cluster');
  if (cluster.isWorker) {
    console.log('Исполнитель %d получил запрос', cluster.worker.id);
  }
  next();
});

app.use(function(req, res, next) {
  // создаем домен для этого запроса
  var domain = require('domain').create();
  // обрабатываем ошибки на этом домене
  domain.on('error', function(err) {
    console.error('ПЕРЕХВАЧЕНА ОШИБКА ДОМЕНА\n', err.stack);
    try {
      // Отказобезопасный останов через 5 секунд
      setTimeout(function() {
        console.error(' Отказобезопасный останов.');
        process.exit(1);
      }, 5000);
      // Отключение от кластера
      var worker = require('cluster').worker;
      if (worker) worker.disconnect();
      // Прекращение принятия новых запросов
      server.close();
      try {
        // Попытка использовать маршрутизацию
        // ошибок Express
        next(err);
      } catch (err) {
        // Если маршрутизация ошибок Express не сработала,
        // пробуем выдать текстовый ответ Node
        console.error('Сбой механизма обработки ошибок ' +
          'Express .\n', err.stack);
        res.statusCode = 500;
        res.setHeader('content-type', 'text/plain');
        res.end('Ошибка сервера.');
      }
    } catch (err) {
      console.error('Не могу отправить ответ 500.\n', err.stack);
    }
  });
  // Добавляем объекты запроса и ответа в домен
  domain.add(req);
  domain.add(res);
  // Выполняем оставшуюся часть цепочки запроса в домене
  domain.run(next);
});

// Routs
app.get('/', function(req, res) {
  res.cookie('monster', 'nom nom');
  res.cookie('signed_monster', 'nom nom', {
    signed: true
  });

  /*emailService.send('eshaft@gmail.com',
    'Сегодня распродажа туров по реке Худ!',
    'Налетайте на них, пока не остыли!');*/

  //email.sendError('Виджет вышел из строя!', __filename, ex);

  res.render('home');
});

// См. маршрут для /cart/add в прилагаемом к книге репозитории
app.get('/vacations', function(req, res) {
  Vacation.find({
    available: true
  }, function(err, vacations) {
    var context = {
      vacations: vacations.map(function(vacation) {
        return {
          sku: vacation.sku,
          name: vacation.name,
          description: vacation.description,
          price: vacation.getDisplayPrice(),
          inSeason: vacation.inSeason,
        };
      })
    };
    res.render('vacations', context);
  });
});

app.get('/about', function(req, res) {
  res.render('about', {
    fortune: fortune.getFortune(),
    pageTestScript: '/qa/tests-about.js'
  });
});

app.get('/tours/hood-river', function(req, res) {
  res.render('tours/hood-river');
});

app.get('/tours/oregon-coast', function(req, res) {
  res.render('tours/oregon-coast');
});

app.get('/tours/request-group-rate', function(req, res) {
  res.render('tours/request-group-rate');
});

app.get('/nursery-rhyme', function(req, res) {
  res.render('nursery-rhyme');
});

app.get('/data/nursery-rhyme', function(req, res) {
  res.json({
    animal: 'бельчонок',
    bodyPart: 'хвост',
    adjective: 'пушистый',
    noun: 'черт',
  });
});

app.get('/newsletter', function(req, res) {
  // мы изучим CSRF позже... сейчас мы лишь
  // заполняем фиктивное значение
  res.render('newsletter', {
    csrf: 'CSRF token goes here'
  });
});

app.post('/process', function(req, res) {
  if (req.xhr || req.accepts('json,html') === 'json') {
    // если здесь есть ошибка, то мы должны отправить { error: 'описание ошибки' }
    res.send({
      success: true
    });
  } else {
    // если бы была ошибка, нам нужно было бы перенаправлять на страницу ошибки
    res.redirect(303, '/thank-you');
  }
});

app.get('/contest/vacation-photo', function(req, res) {
  var now = new Date();
  res.render('contest/vacation-photo', {
    year: now.getFullYear(),
    month: now.getMonth()
  });
});

app.post('/contest/vacation-photo/:year/:month', function(req, res) {
  // Проверяем, существует ли каталог
  var dataDir = __dirname + '/data';
  var vacationPhotoDir = dataDir + '/vacation-photo';
  fs.existsSync(dataDir) || fs.mkdirSync(dataDir);
  fs.existsSync(vacationPhotoDir) || fs.mkdirSync(vacationPhotoDir);

  function saveContestEntry(contestName, email, year, month, photoPath) {
    // TODO... это будет добавлено позднее
  }

  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {
    if (err) {
      res.session.flash = {
        type: 'danger',
        intro: 'Упс!',
        message: 'Во время обработки отправленной Вами формы ' +
          'произошла ошибка. Пожалуйста, попробуйте еще раз.',
      };
      return res.redirect(303, '/contest/vacation-photo');
    }
    var photo = files.photo;
    var dir = vacationPhotoDir + '/' + Date.now();
    var path = dir + '/' + photo.name;
    fs.mkdirSync(dir);
    fs.renameSync(photo.path, dir + '/' + photo.name);
    saveContestEntry('vacation-photo', fields.email,
      req.params.year, req.params.month, path);
    req.session.flash = {
      type: 'success',
      intro: 'Удачи!',
      message: 'Вы стали участником конкурса.',
    };
    return res.redirect(303, '/contest/vacation-photo/entries');
  });
});

app.use('/upload', function(req, res, next) {
  var now = Date.now();
  jqupload.fileHandler({
    uploadDir: function() {
      return __dirname + '/public/uploads/' + now;
    },
    uploadUrl: function() {
      return '/uploads/' + now;
    },
  })(req, res, next);
});

app.get('/contest/vacation-photo-uploader', function(req, res) {
  var now = new Date();
  res.render('contest/vacation-photo-uploader', {
    year: now.getFullYear(),
    month: now.getMonth()
  });
});

app.get('/fail', function(req, res) {
  throw new Error('Нет!');
});

app.get('/epic-fail', function(req, res) {
  process.nextTick(function() {
    throw new Error('Бабах!');
  });
});

// Обобщенный обработчик 404 (промежуточное ПО)
app.use(function(req, res, next) {
  res.status(404);
  res.render('404');
});

// Обработчик ошибки 500 (промежуточное ПО)
app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(500);
  res.render('500');
});


function startServer() {
  app.listen(app.get('port'), function() {
    console.log('Express запущен в режиме ' + app.get('env') +
      ' на http://localhost:' + app.get('port') +
      '; нажмите Ctrl+C для завершения.');
  });
}
if (require.main === module) {
  // Приложение запускается непосредственно;
  // запускаем сервер приложения
  startServer();
} else {
  // Приложение импортируется как модуль
  // посредством "require":
  // экспортируем функцию для создания сервера
  module.exports = startServer;
}
