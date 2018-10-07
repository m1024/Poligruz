var Logger = require('logplease');
var log = Logger.create('messages', { filename: './logs/log.log'});
var messages = {};
var io = require('./io');


// Отправка ошибки
messages.sendError = function(message, socket) {
    //Логирование события
    log.debug('Send error message: ' + message + '. To: ' + socket.id);

    // Отправка ошибки
    socket.emit('notification', {
        type: 'error',
        message: message
    });
};

// Отправка Информации
messages.sendInfo = function(message, socket) {
    //Логирование события
    log.debug('Send info message: ' + message + '. To: ' + socket.id);

    // Отправка ошибки
    socket.emit('notification', {
        type: 'info',
        message: message
    });
};

// Отправка команды
messages.sendCommand = function(command, socket) {
    //Логирование события
    log.debug('Send command: ' + command.name + '. To: ' + socket.id);

    // Отправка команды
    socket.emit('command', command);
};

// Отправка команды всем
messages.sendBroadcastCommand = function (command, socket) {
    //Логирование события
    log.debug('Send Broadcast command: ' + command.name + '.');

    // Отправка команды
    //socket.broadcast.emit('command', command);
    socket.broadcast.emit('command', command);
    //console.log(socket);
    //io.sockets.emit('command', command);
    //io.broadcast('command', command);
};

// Отправка данных
messages.sendData = function(name, data, flags, socket) {
    //Логирование события
    log.debug('Send data: ' + name + '. To: ' + socket.id);

    // Отправка данных
    socket.emit('data', {name: name, data: data, flags: flags});
};

module.exports = messages;