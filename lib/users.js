var Logger = require('logplease');
var log = Logger.create('users', { filename: './logs/log.log'});

var users = {};
users.list = [];


// Добавление пользователя в список авторизованных
users.addUser = function (user, sessionID) {
    //Логирование события
    log.debug('Add user: ' + user.login + ', SessionID: ' + sessionID);

    //todo: Проверка параллельного входа
    user.sessionID = sessionID;
    users.list.push(user);
    log.info('User ' + user.login + ' was added');
};

// Удаление пользователя из списка по его sessionID
users.removeUserBySessionID = function (sessionID, cb) {
    //Логирование события
    log.debug('Remove user. SessionID: ' + sessionID);

    users.getUserBySessionID(sessionID, function (user) {
        var userLogin = user.login;
        var result = users.list.splice(users.list.indexOf(user), 1);
        if (result.length !== 0) {
            log.info('User ' + userLogin + ' was removed');
            cb(true);
        }
        else {
            log.warn('Can\'t remove user. User not found in authentificated users list.');
            cb(false)
        }
    });
};



// Поиск пользователя среди авторизованных по его sessionID
users.getUserBySessionID = function (sessionID, cb) {
    var user = users.list.filter(function (user) {
        if (user.sessionID === sessionID)
            return user;
    });
    if (user.length === 0)
        user = undefined;
    else
        user = user[0];
    cb(user);
};

module.exports = users;