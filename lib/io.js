var io = require('../bin/server').io;
var commands = require('./commands');
var users = require('./users');
var messages = require('./messages');
var Logger = require('logplease');
var log = Logger.create('io', { filename: './logs/log.log'});

// Обработка соединений
io.on('connection', function (socket) {
    log.debug('Client connected: ', socket.id);

    // Проверка нахождения пользователя в списке авторизованных
    var sessionID = commands.getSessionIDFromSocket(socket);
    users.getUserBySessionID(sessionID, function (user) {
        if (user === undefined && socket.handshake.headers.referer.search('/logon') === -1) {
            // Послать команду logout
            messages.sendCommand({name: 'logout'}, socket);
        }
    });

    // Обработка поступившей команды
    socket.on('command', function (command) {
        // Передача команды в модуль обработки команд
        commands.execCommand(command, socket);
    });
});

module.exports = io;